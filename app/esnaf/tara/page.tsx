'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useZimemStore } from '@/store/useZimemStore';
import { parseAmountText as parseAmount, useScanStore, type ReviewRow } from '@/store/useScanStore';
import { useI18n } from '@/lib/i18n';
import { DEBT_KINDS, KIND_META, kindChipStyle, kindOf } from '@/lib/debts';
import {
  getScannerStatus,
  prepareImage,
  saveLedgerRef,
  scanErrorKey,
  type ScannedEntry,
  type ScanStage,
} from '@/lib/ledgerScan';

// Okuma süreci useScanStore'da yaşar: bu sayfadan çıkılsa da sürer ve sonuç
// inceleme listesine eklenir. Burada yalnızca ekran durumu tutulur.
type Mode = 'idle' | 'quality' | 'saving' | 'done';

interface PendingPhoto {
  base64: string;
  photo: string;
  dark: boolean;
  blurry: boolean;
}

/** 70 + 60 − 50 = 80 */
function breakdownText(b: ScannedEntry['breakdown']): string | null {
  if (!b || b.debts.length + b.payments.length < 2) return null;
  const sum = b.debts.reduce((s, n) => s + n, 0) - b.payments.reduce((s, n) => s + n, 0);
  const parts = [b.debts.join(' + '), ...b.payments.map((n) => `− ${n}`)].filter(Boolean);
  return `${parts.join(' ')} = ${sum}`;
}

function breakdownSum(b: ScannedEntry['breakdown']): number {
  if (!b) return 0;
  return b.debts.reduce((s, n) => s + n, 0) - b.payments.reduce((s, n) => s + n, 0);
}

const URGENCY_KEY = { 1: 'debt.low', 2: 'debt.medium', 3: 'debt.high' } as const;
const STAGE_KEY: Record<ScanStage, string> = {
  uploading: 'scan.stage_uploading',
  queued: 'scan.stage_queued',
  processing: 'scan.scanning',
};
const STAGE_PROGRESS: Record<ScanStage, string> = { uploading: '20%', queued: '45%', processing: '75%' };

function isValidAmount(n: number) {
  return n >= 1 && n <= 100000;
}

export default function ScanLedgerPage() {
  const router = useRouter();
  const addDebt = useZimemStore((s) => s.addMerchantDebt);
  const refreshMerchantDebts = useZimemStore((s) => s.refreshMerchantDebts);
  const rows = useScanStore((s) => s.rows);
  const jobs = useScanStore((s) => s.jobs);
  const photos = useScanStore((s) => s.photos);
  const warning = useScanStore((s) => s.warning);
  const lastError = useScanStore((s) => s.lastError);
  const startScan = useScanStore((s) => s.startScan);
  const updateRow = useScanStore((s) => s.updateRow);
  const removeRow = useScanStore((s) => s.removeRow);
  const clearReview = useScanStore((s) => s.clearReview);
  const clearError = useScanStore((s) => s.clearError);
  const { t } = useI18n();

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [progress, setProgress] = useState({ done: 0, count: 0 });
  const [result, setResult] = useState({ saved: 0, failed: 0 });
  // null → henüz bilinmiyor / kontrol edilemedi
  const [scanner, setScanner] = useState<{ online: boolean; model: string | null } | null>(null);
  const [checking, setChecking] = useState(true);

  // Kalıcı tarama oturumu (inceleme listesi) istemcide yüklenir; sunucu çıktısıyla karışmasın.
  const list = mounted ? rows : [];
  const running = mounted ? jobs : [];
  const phase = mode !== 'idle' ? mode : list.length > 0 ? 'review' : 'pick';

  const refreshScanner = async () => {
    setChecking(true);
    setScanner(await getScannerStatus());
    setChecking(false);
  };

  useEffect(() => {
    setMounted(true);
    // Başka hesabın yarım kalmış oturumu görünmesin; kalan işlerin takibi sürsün.
    useScanStore.getState().resume();
    // "Zaten eklenmiş olabilir" tespiti sunucudaki güncel deftere göre yapılsın.
    void refreshMerchantDebts();
  }, [refreshMerchantDebts]);

  // Tarama bilgisayarının durumunu seçim/inceleme ekranındayken 15 sn'de bir yenile.
  useEffect(() => {
    if (phase !== 'pick' && phase !== 'review') return;
    let active = true;
    const tick = async () => {
      const status = await getScannerStatus();
      if (active) {
        setScanner(status);
        setChecking(false);
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [phase]);

  const selectedRows = list.filter((r) => r.selected && isValidAmount(parseAmount(r.amountText)));
  const selectedTotal = selectedRows.reduce((sum, r) => sum + parseAmount(r.amountText), 0);
  const photoPages = Object.keys(photos)
    .map(Number)
    .filter((page) => list.some((r) => r.page === page))
    .sort((a, b) => a - b);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    clearError();
    let prepared;
    try {
      prepared = await prepareImage(file);
    } catch {
      setError(t(scanErrorKey('bad_image')));
      return;
    }
    const photo = URL.createObjectURL(file);
    // Belirgin karanlık/bulanık fotoğraf: göndermeden önce yeniden çekmeyi öner.
    if (prepared.dark || prepared.blurry) {
      setPending({ ...prepared, photo });
      setMode('quality');
      return;
    }
    startScan(prepared.base64, photo);
  }

  function discardPending(retake: boolean) {
    if (pending) URL.revokeObjectURL(pending.photo);
    setPending(null);
    setMode('idle');
    if (retake) cameraInput.current?.click();
  }

  function openPhoto(page: number) {
    setZoomed(false);
    setViewer(page);
  }

  async function saveSelected() {
    const toSave: ReviewRow[] = selectedRows;
    if (toSave.length === 0) return;
    setMode('saving');
    setProgress({ done: 0, count: toSave.length });

    let saved = 0;
    const failedRows: ReviewRow[] = [];
    for (const row of toSave) {
      const description =
        row.description.trim().length >= 3 ? row.description.trim().slice(0, 180) : t('scan.desc_default');
      try {
        const kind = kindOf(row);
        const result = await addDebt({
          category: KIND_META[kind].group,
          kind,
          icon: KIND_META[kind].emoji,
          title: t(`debt.kind_title_${kind}`),
          description,
          amount: parseAmount(row.amountText),
          urgency: row.urgency,
        });
        if (result) {
          if (row.ref) saveLedgerRef(result.id, row.ref);
          removeRow(row.key);
          saved += 1;
        } else {
          failedRows.push(row);
        }
      } catch {
        failedRows.push(row);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setResult({ saved, failed: failedRows.length });
    // Kaydedilemeyen satırlar incelemede kalır; esnaf bağlantı düzelince tekrar dener.
    if (failedRows.length === 0) clearReview();
    setMode('done');
  }

  const fileInputs = (
    <>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );

  // Bilgisayarın kapalı olduğu KESİN biliniyorsa fotoğraf göndermeyi engelle;
  // durum okunamadıysa (null) denemeye izin ver, kuyruk zaman aşımı zaten yakalar.
  const scannerOffline = scanner?.online === false;

  const pickButtons = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <button type="button" className="btn btn-primary" disabled={scannerOffline} onClick={() => cameraInput.current?.click()}>
        {t('scan.take_photo')}
      </button>
      <button type="button" className="btn" disabled={scannerOffline} onClick={() => galleryInput.current?.click()}>
        {t('scan.pick_gallery')}
      </button>
    </div>
  );

  const scannerBadge = (
    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
      <span className="inline-flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            checking ? 'bg-white/30 animate-pulse' : scanner?.online ? 'bg-emerald-400' : scanner ? 'bg-red-400' : 'bg-amber-400'
          }`}
        />
        {checking
          ? t('scan.status_checking')
          : scanner?.online
            ? t('scan.status_online')
            : scanner
              ? t('scan.status_offline')
              : t('scan.status_unknown')}
      </span>
      {!checking && !scanner?.online && (
        <button type="button" className="text-muted-c hover:text-white bg-transparent border-0 p-0" onClick={() => void refreshScanner()}>
          {t('scan.status_retry')}
        </button>
      )}
    </div>
  );

  return (
    <div className="pt-6 max-w-2xl mx-auto">
      {fileInputs}

      <div className="mb-5">
        <Link href="/esnaf" className="text-sm text-muted-c hover:text-white">
          {t('merchant.back_to_book')}
        </Link>
        <h1 className="heading-xl mt-2">{t('scan.title')}</h1>
        <p className="text-sm text-muted-c">{t('scan.subtitle')}</p>
      </div>

      {(error || (mounted && lastError)) && (
        <div className="mb-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error || (lastError ? t(scanErrorKey(lastError)) : '')}
        </div>
      )}

      {/* Süren okumalar: sayfadan çıkılsa da devam eder */}
      {(phase === 'pick' || phase === 'review') && running.length > 0 && (
        <div className="glass p-4 mb-4 space-y-3">
          {running.map((job) => (
            <div key={job.localId} className="flex items-center gap-3">
              {photos[job.page] ? (
                // eslint-disable-next-line @next/next/no-img-element -- yerel blob önizlemesi
                <img src={photos[job.page]} alt="" className="h-14 w-11 object-cover rounded-lg shrink-0" />
              ) : (
                <div className="h-14 w-11 rounded-lg bg-white/5 grid place-items-center shrink-0" aria-hidden>
                  📄
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">
                  {t('scan.photo_page', { n: job.page })} · {t(STAGE_KEY[job.stage])}
                </div>
                <div className="progress-track mt-2">
                  <div className="progress-fill animate-pulse" style={{ width: STAGE_PROGRESS[job.stage] }} />
                </div>
              </div>
              <span className="text-2xl animate-pulse shrink-0" aria-hidden>
                📖
              </span>
            </div>
          ))}
          <p className="text-xs text-muted-c">
            {t('scan.scanning_hint')} {t('scan.bg_hint')}
          </p>
        </div>
      )}

      {phase === 'pick' && (
        <div className="glass p-6 space-y-5">
          {mounted && warning && running.length === 0 && <p className="text-[13px] text-amber-300">⚠️ {warning}</p>}
          {scannerBadge}
          {scannerOffline && <p className="text-xs text-amber-300">{t('scan.offline_help')}</p>}
          {pickButtons}
          <div>
            <div className="section-title mb-2">{t('scan.tips_title')}</div>
            <ul className="text-sm text-muted-c space-y-1 list-disc ps-5">
              <li>{t('scan.tip_1')}</li>
              <li>{t('scan.tip_2')}</li>
              <li>{t('scan.tip_3')}</li>
            </ul>
          </div>
          <p className="text-xs text-muted-c opacity-80">🔒 {t('scan.privacy')}</p>
        </div>
      )}

      {phase === 'quality' && pending && (
        <div className="glass p-6 space-y-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob önizlemesi */}
          <img src={pending.photo} alt="" className="max-h-64 mx-auto rounded-xl" />
          <div className="space-y-2 text-sm text-amber-200">
            {pending.dark && <p>🌙 {t('scan.quality_dark')}</p>}
            {pending.blurry && <p>🌫️ {t('scan.quality_blurry')}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" className="btn btn-primary" onClick={() => discardPending(true)}>
              📷 {t('scan.quality_retake')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const { base64, photo } = pending;
                setPending(null);
                setMode('idle');
                startScan(base64, photo);
              }}
            >
              {t('scan.quality_send')}
            </button>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          <div className="glass p-5">
            <div className="font-bold">{t('scan.review_title')}</div>
            <p className="text-xs text-muted-c mt-1">{t('scan.review_desc')}</p>
            {warning && <p className="text-xs text-amber-300 mt-2">⚠️ {warning}</p>}
            {photoPages.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {photoPages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => openPhoto(page)}
                    className="shrink-0 rounded-lg overflow-hidden border border-white/15 bg-transparent p-0 relative"
                    aria-label={t('scan.photo_page', { n: page })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob önizlemesi */}
                    <img src={photos[page]} alt="" className="h-20 w-auto block" />
                    <span className="absolute bottom-0 inset-x-0 text-[11px] bg-black/60 text-white py-0.5">
                      {t('scan.photo_page', { n: page })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {list.map((r) => {
            const amount = parseAmount(r.amountText);
            const amountOk = isValidAmount(amount);
            return (
              <div
                key={r.key}
                className={`glass p-4 space-y-3 transition-opacity ${r.selected ? '' : 'opacity-60'}`}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={(e) => updateRow(r.key, { selected: e.target.checked })}
                      className="w-5 h-5 accent-amber-400"
                    />
                    <span className="text-sm font-semibold">
                      {r.ref ? `🔒 ${r.ref}` : '—'}
                    </span>
                  </label>
                  {r.date && <span className="text-xs text-muted-c">{r.date}</span>}
                  {r.paid && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                      {t('scan.paid_badge')}
                    </span>
                  )}
                  {r.duplicate && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">
                      {t('scan.dup_badge')}
                    </span>
                  )}
                  {(r.issue || r.confidence === 'low') && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                      ⚠️ {t('scan.low_badge')}
                    </span>
                  )}
                  <button
                    type="button"
                    className="ms-auto text-xs text-muted-c hover:text-red-400"
                    onClick={() => removeRow(r.key)}
                  >
                    {t('scan.remove')}
                  </button>
                </div>

                {r.issue === 'mismatch' && r.breakdown && r.breakdown.written !== null && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100 space-y-2">
                    <p>{t('scan.issue_mismatch', { written: r.breakdown.written, sum: breakdownSum(r.breakdown) })}</p>
                    <div className="flex gap-2 flex-wrap">
                      {[r.breakdown.written, breakdownSum(r.breakdown)]
                        .filter((n, i, list) => isValidAmount(n) && list.indexOf(n) === i)
                        .map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => updateRow(r.key, { amountText: String(n), selected: true, issue: null })}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                              parseAmount(r.amountText) === n
                                ? 'border-amber-300 bg-amber-400/25 text-amber-50'
                                : 'border-white/15 bg-white/5 text-white'
                            }`}
                          >
                            {t('scan.use_amount', { amount: n })}
                          </button>
                        ))}
                      {photos[r.page] && (
                        <button type="button" className="text-xs text-amber-200 underline bg-transparent border-0 p-0" onClick={() => openPhoto(r.page)}>
                          {t('scan.photo_show')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {(r.issue === 'unclear' || r.issue === 'maybe_paid') && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100 flex items-start gap-2 flex-wrap">
                    <p className="flex-1 min-w-[12rem]">{t(r.issue === 'maybe_paid' ? 'scan.issue_maybe_paid' : 'scan.issue_unclear')}</p>
                    {photos[r.page] && (
                      <button type="button" className="text-xs text-amber-200 underline bg-transparent border-0 p-0" onClick={() => openPhoto(r.page)}>
                        {t('scan.photo_show')}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-1.5 flex-wrap">
                  {DEBT_KINDS.map((k) => {
                    const active = kindOf(r) === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={active}
                        onClick={() => updateRow(r.key, { kind: k, category: KIND_META[k].group })}
                        className={`category-chip ${active ? 'ring-2 ring-white/40' : 'opacity-50'}`}
                        style={kindChipStyle(k)}
                      >
                        {KIND_META[k].emoji} {t(`debt.kind_${k}`)}
                      </button>
                    );
                  })}
                </div>

                <label className="block">
                  <div className="text-xs text-muted-c mb-1">{t('scan.items_label')}</div>
                  <input
                    type="text"
                    value={r.description}
                    maxLength={180}
                    placeholder={t('merchant.desc_ph')}
                    onChange={(e) => updateRow(r.key, { description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 outline-none text-sm"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-xs text-muted-c mb-1">{t('scan.amount_label')}</div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={r.amountText}
                      onChange={(e) =>
                        updateRow(r.key, { amountText: e.target.value.replace(/[^0-9.,]/g, '') })
                      }
                      className={`w-full px-3 py-2 rounded-xl bg-white/5 border outline-none text-sm ${
                        amountOk ? 'border-white/10 focus:border-purple-400' : 'border-red-500/60'
                      }`}
                    />
                    {breakdownText(r.breakdown) && (
                      <div className="text-xs text-muted-c mt-1 tabular-nums" dir="ltr">{breakdownText(r.breakdown)}</div>
                    )}
                    {r.breakdown?.written != null && r.issue !== 'mismatch' && (
                      <div className="text-xs text-muted-c mt-0.5">✓ {t('scan.written_total', { amount: r.breakdown.written })}</div>
                    )}
                  </label>
                  <div>
                    <div className="text-xs text-muted-c mb-1">{t('merchant.step_urgency')}</div>
                    <div className="grid grid-cols-3 gap-1">
                      {([1, 2, 3] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => updateRow(r.key, { urgency: u })}
                          className={`px-1 py-2 rounded-lg text-xs font-semibold border ${
                            r.urgency === u
                              ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                              : 'border-white/10 bg-white/5 text-muted-c'
                          }`}
                        >
                          {t(URGENCY_KEY[u])}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="glass p-4 space-y-2">
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={selectedRows.length === 0}
              onClick={() => void saveSelected()}
            >
              {t('scan.add_selected', { count: selectedRows.length, total: selectedTotal })}
            </button>
            <div className="text-xs text-muted-c text-center pt-1">{t('scan.scan_more')}</div>
            {scannerBadge}
            {pickButtons}
          </div>
          <p className="text-xs text-muted-c text-center opacity-80">🔒 {t('scan.privacy')}</p>
        </div>
      )}

      {phase === 'saving' && (
        <div className="glass p-6 text-center">
          <div className="text-3xl mb-2 animate-pulse">📒</div>
          <div className="font-semibold">
            {t('scan.saving', { done: progress.done, count: progress.count })}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="glass p-6 text-center space-y-3">
          <div className="text-5xl">✅</div>
          <div className="font-bold text-lg">{t('scan.done_title', { count: result.saved })}</div>
          {result.failed > 0 && (
            <>
              <p className="text-sm text-amber-300">{t('scan.done_failed', { count: result.failed })}</p>
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => {
                  setError('');
                  setMode('idle');
                }}
              >
                {t('scan.retry_failed', { count: result.failed })}
              </button>
            </>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button type="button" className="btn" onClick={() => { setError(''); setMode('idle'); }}>
              {t('scan.restart')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => router.push('/esnaf/')}>
              {t('scan.back')}
            </button>
          </div>
        </div>
      )}

      {viewer !== null && photos[viewer] && (
        <div
          className="fixed inset-0 z-50 bg-[#0b0e16] flex flex-col"
          role="dialog"
          aria-modal="true"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-white">
            <span className="font-semibold">{t('scan.photo_page', { n: viewer })}</span>
            <div className="flex gap-2">
              <button type="button" className="btn !py-1.5 !px-3" onClick={() => setZoomed((z) => !z)} aria-pressed={zoomed}>
                {zoomed ? '🔍−' : '🔍+'}
              </button>
              <button type="button" className="btn !py-1.5 !px-3" onClick={() => setViewer(null)}>
                {t('scan.photo_close')}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element -- yerel blob önizlemesi */}
            <img
              src={photos[viewer]}
              alt=""
              onClick={() => setZoomed((z) => !z)}
              className="block max-w-none mx-auto"
              style={{ width: zoomed ? '220%' : '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { CATEGORY_ICONS, CATEGORY_META } from '@/lib/debts';
import {
  getScannerStatus,
  readLedgerRefs,
  saveLedgerRef,
  scanErrorKey,
  scanLedgerPage,
  type ScannedEntry,
  type ScanStage,
} from '@/lib/ledgerScan';
import type { Category } from '@/types';

type Phase = 'pick' | 'scanning' | 'review' | 'saving' | 'done';

interface Row extends ScannedEntry {
  key: string;
  selected: boolean;
  duplicate: boolean;
  urgency: 1 | 2 | 3;
  description: string;
  amountText: string;
}

const URGENCY_KEY = { 1: 'debt.low', 2: 'debt.medium', 3: 'debt.high' } as const;
const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

function parseAmount(text: string): number {
  const n = Math.round(Number(text.replace(/\./g, '').replace(',', '.')));
  return Number.isFinite(n) ? n : 0;
}

function isValidAmount(n: number) {
  return n >= 1 && n <= 100000;
}

export default function ScanLedgerPage() {
  const router = useRouter();
  const addDebt = useZimemStore((s) => s.addMerchantDebt);
  const merchantDebts = useZimemStore((s) => s.merchantDebts);
  const { t } = useI18n();

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('pick');
  const [rows, setRows] = useState<Row[]>([]);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, count: 0 });
  const [result, setResult] = useState({ saved: 0, failed: 0 });
  const [stage, setStage] = useState<ScanStage>('uploading');
  // null → henüz bilinmiyor / kontrol edilemedi
  const [scanner, setScanner] = useState<{ online: boolean; model: string | null } | null>(null);
  const [checking, setChecking] = useState(true);

  const refreshScanner = async () => {
    setChecking(true);
    setScanner(await getScannerStatus());
    setChecking(false);
  };

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

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const selectedRows = rows.filter((r) => r.selected && isValidAmount(parseAmount(r.amountText)));
  const selectedTotal = selectedRows.reduce((sum, r) => sum + parseAmount(r.amountText), 0);

  // Aynı sayfa iki kez taranırsa ya da borç zaten eklenmişse tekrarı işaretle.
  const knownKeys = useMemo(() => {
    const refs = readLedgerRefs();
    const keys = new Set<string>();
    for (const d of merchantDebts) {
      if (!d.closed && refs[d.id]) keys.add(`${refs[d.id]}|${d.amount}`);
    }
    return keys;
  }, [merchantDebts]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setWarning('');
    setPreview(URL.createObjectURL(file));
    setStage('uploading');
    setPhase('scanning');

    const res = await scanLedgerPage(file, setStage);
    if (!res.ok) {
      setError(t(scanErrorKey(res.error)));
      setPhase(rows.length > 0 ? 'review' : 'pick');
      return;
    }

    setWarning(res.warning);
    setRows((prev) => {
      const seen = new Set([
        ...knownKeys,
        ...prev.map((r) => `${r.ref}|${parseAmount(r.amountText)}`),
      ]);
      const added: Row[] = res.entries.map((e, i) => {
        const dupKey = `${e.ref}|${e.amount}`;
        const duplicate = !!e.ref && seen.has(dupKey);
        seen.add(dupKey);
        return {
          ...e,
          key: `${Date.now()}-${i}`,
          selected: !e.paid && !duplicate,
          duplicate,
          urgency: 2,
          description: e.items,
          amountText: String(e.amount),
        };
      });
      return [...prev, ...added];
    });
    setPhase('review');
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function saveSelected() {
    const toSave = selectedRows;
    if (toSave.length === 0) return;
    setPhase('saving');
    setProgress({ done: 0, count: toSave.length });

    let saved = 0;
    let failed = 0;
    for (const row of toSave) {
      const description =
        row.description.trim().length >= 3 ? row.description.trim().slice(0, 180) : t('scan.desc_default');
      try {
        const { id, synced } = await addDebt({
          category: row.category,
          icon: CATEGORY_ICONS[row.category][0],
          title: t(`scan.title_${row.category}`),
          description,
          amount: parseAmount(row.amountText),
          urgency: row.urgency,
        });
        if (row.ref) saveLedgerRef(id, row.ref);
        if (synced) saved += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setResult({ saved, failed });
    setRows([]);
    setPhase('done');
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

      {error && (
        <div className="mb-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {phase === 'pick' && (
        <div className="glass p-6 space-y-5">
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
          <p className="text-[11px] text-muted-c opacity-80">🔒 {t('scan.privacy')}</p>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="glass p-6 text-center">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- yerel blob önizlemesi
            <img src={preview} alt="" className="max-h-64 mx-auto rounded-xl mb-4 opacity-80" />
          )}
          <div className="text-3xl mb-2 animate-pulse">📖</div>
          <div className="font-semibold">
            {stage === 'uploading' ? t('scan.stage_uploading') : stage === 'queued' ? t('scan.stage_queued') : t('scan.scanning')}
          </div>
          <div className="text-xs text-muted-c mt-1">{t('scan.scanning_hint')}</div>
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          <div className="glass p-5">
            <div className="font-bold">{t('scan.review_title')}</div>
            <p className="text-xs text-muted-c mt-1">{t('scan.review_desc')}</p>
            {warning && <p className="text-xs text-amber-300 mt-2">⚠️ {warning}</p>}
          </div>

          {rows.length === 0 && (
            <div className="glass p-6 text-center text-sm text-muted-c">{t('scan.none_found')}</div>
          )}

          {rows.map((r) => {
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
                  {r.date && <span className="text-[11px] text-muted-c">{r.date}</span>}
                  {r.paid && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                      {t('scan.paid_badge')}
                    </span>
                  )}
                  {r.duplicate && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">
                      {t('scan.dup_badge')}
                    </span>
                  )}
                  {r.confidence === 'low' && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                      {t('scan.low_badge')}
                    </span>
                  )}
                  <button
                    type="button"
                    className="ms-auto text-[11px] text-muted-c hover:text-red-400"
                    onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                  >
                    {t('scan.remove')}
                  </button>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateRow(r.key, { category: c })}
                      className={`category-chip cat-${c} ${r.category === c ? 'ring-2 ring-white/40' : 'opacity-50'}`}
                    >
                      {CATEGORY_META[c].emoji} {t(`debt.cat_${c}`)}
                    </button>
                  ))}
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
                  </label>
                  <div>
                    <div className="text-xs text-muted-c mb-1">{t('merchant.step_urgency')}</div>
                    <div className="grid grid-cols-3 gap-1">
                      {([1, 2, 3] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => updateRow(r.key, { urgency: u })}
                          className={`px-1 py-2 rounded-lg text-[11px] font-semibold border ${
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
          <p className="text-[11px] text-muted-c text-center opacity-80">🔒 {t('scan.privacy')}</p>
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
            <p className="text-sm text-amber-300">{t('scan.done_failed', { count: result.failed })}</p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button type="button" className="btn" onClick={() => { setError(''); setPhase('pick'); }}>
              {t('scan.restart')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => router.push('/esnaf/')}>
              {t('scan.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

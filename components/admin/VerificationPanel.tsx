'use client';
// Yönetici: muhtar doğrulama formlarını işle. Muhtar borcu yerinde teyit edip imzalı ve
// mühürlü formu doldurur; burada borç "onaylı" ya da "reddedildi" yapılır. Muhtarlık ve
// form numarası yalnızca yöneticinin okuyabildiği tabloda saklanır. Borçlunun adı ya da
// kimliği buraya YAZILMAZ.
import { useCallback, useEffect, useState } from 'react';
import { fetchVerificationQueue, setDebtVerification, type QueueDebt } from '@/lib/pledges';
import { formatTL } from '@/lib/debts';
import type { Verification } from '@/types';

const LABEL: Record<Verification, string> = {
  pending: '⏳ Bekliyor',
  verified: '✔ Onaylı',
  rejected: '✖ Reddedildi',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function VerificationPanel() {
  const [queue, setQueue] = useState<QueueDebt[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Verification>('pending');

  const load = useCallback(async () => {
    const rows = await fetchVerificationQueue();
    if (!rows) {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    setQueue(rows);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (debt: QueueDebt, status: Verification) => {
    const reference = (refs[debt.id] ?? '').trim();
    if (status !== 'pending' && reference.length < 3) {
      setError('Muhtarlık adını ve form numarasını yaz (ör. "Fatih Mah. Muhtarlığı, form 12").');
      return;
    }
    if (status === 'pending' && !confirm(`"${debt.title}" yeniden "bekliyor" durumuna alınsın mı? Bekleyen ödeme kodları iptal edilir.`)) return;
    setBusyId(debt.id);
    setError('');
    const result = await setDebtVerification(debt.id, status, reference);
    setBusyId(null);
    if (!result.ok) {
      setError(`Kaydedilemedi: ${result.error ?? 'borç bulunamadı'}`);
      return;
    }
    setRefs((r) => ({ ...r, [debt.id]: '' }));
    await load();
  };

  if (unavailable) {
    return (
      <section className="glass p-4 mb-6 text-sm text-muted-c">
        <h2 className="heading-lg mb-1 text-white">Muhtar doğrulaması</h2>
        Bu bölüm için <code>20261124120000_muhtar_verification_direct_payment.sql</code> göçünü SQL Editor’de çalıştırın.
      </section>
    );
  }

  const rows = (queue ?? []).filter((d) => d.verification === tab);
  const counts = (queue ?? []).reduce<Record<Verification, number>>(
    (acc, d) => ({ ...acc, [d.verification]: acc[d.verification] + 1 }),
    { pending: 0, verified: 0, rejected: 0 },
  );

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="heading-lg">Muhtar doğrulaması</h2>
        <button type="button" className="btn" onClick={() => void load()}>
          Yenile
        </button>
      </div>
      <p className="text-xs text-muted-c mb-3">
        Muhtarın imzalı ve mühürlü doğrulama formunu gördükten sonra işaretleyin. Onaylı borçlar yalnızca esnafa
        doğrudan yapılan gerçek ödemeyle kapanır; simülasyon ödemesi onaylı borçları kapatmaz. Borçlunun adını buraya
        yazmayın.
      </p>
      <div className="flex gap-2 flex-wrap mb-3">
        {(['pending', 'verified', 'rejected'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setTab(v)} className={`tab-btn ${tab === v ? 'active' : ''}`}>
            {LABEL[v]} ({counts[v]})
          </button>
        ))}
      </div>
      {error && <div className="glass p-3 mb-3 text-sm text-red-300">{error}</div>}
      {queue === null ? (
        <div className="glass p-6 text-center text-sm text-muted-c">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="glass p-6 text-center text-sm text-muted-c">Bu durumda borç yok.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((d) => (
            <div key={d.id} className="glass p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[15px]">{d.title}</div>
                  <div className="text-xs text-muted-c">{d.description}</div>
                  <div className="text-xs text-muted-c mt-1">
                    🏪 {d.merchantName}
                    {d.city && ` · 📍 ${d.city}`} · {fmt(d.createdAt)} · <span className="font-mono">{d.id.slice(0, 8)}</span>
                  </div>
                  {d.reference && (
                    <div className="text-xs mt-1 text-amber-200/90">
                      📄 {d.reference}
                      {d.decidedAt && ` · ${fmt(d.decidedAt)}`}
                    </div>
                  )}
                </div>
                <div className="font-bold text-amber-200 tabular-nums shrink-0">{formatTL(d.amount)}</div>
              </div>
              {d.verification === 'pending' ? (
                <div className="mt-3 flex gap-2 flex-wrap items-center">
                  <input
                    value={refs[d.id] ?? ''}
                    onChange={(e) => setRefs((r) => ({ ...r, [d.id]: e.target.value }))}
                    placeholder="Muhtarlık ve form no"
                    maxLength={160}
                    aria-label={`${d.title} için muhtarlık ve form no`}
                    className="flex-1 min-w-[180px] bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/50"
                  />
                  <button
                    type="button"
                    className="btn btn-primary !text-[13px]"
                    disabled={busyId === d.id}
                    onClick={() => void decide(d, 'verified')}
                  >
                    ✔ Onayla
                  </button>
                  <button
                    type="button"
                    className="btn !text-[13px]"
                    disabled={busyId === d.id}
                    onClick={() => void decide(d, 'rejected')}
                  >
                    ✖ Reddet
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <button
                    type="button"
                    className="text-xs text-muted-c hover:text-white"
                    disabled={busyId === d.id}
                    onClick={() => void decide(d, 'pending')}
                  >
                    ↩ Bekliyor durumuna al
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

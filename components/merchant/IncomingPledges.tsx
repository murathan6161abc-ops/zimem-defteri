'use client';
// Esnaf: bağışçıların doğrudan ödeme bildirimleri. Esnaf parayı aldıysa onaylar; borç
// ancak o zaman sunucuda düşer/kapanır.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n, tStatic } from '@/lib/i18n';
import { formatTL } from '@/lib/debts';
import { getCurrentUserId } from '@/lib/auth';
import { daysWaiting, fetchIncomingPledges, resolvePledge, subscribeToPledges, type Pledge } from '@/lib/pledges';

export default function IncomingPledges() {
  const { t, locale } = useI18n();
  const refreshMerchantDebts = useZimemStore((s) => s.refreshMerchantDebts);
  const pushToast = useZimemStore((s) => s.pushToast);
  const [pledges, setPledges] = useState<Pledge[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    const server = await fetchIncomingPledges(getCurrentUserId());
    if (!server) return;
    // İlk yüklemeden sonra gelen yeni bekleyen ödemeler için bildirim.
    if (seen.current) {
      for (const p of server) {
        if (p.status === 'pending' && !seen.current.has(p.id)) {
          pushToast({
            title: tStatic('realpay.m_toast_pledge_title'),
            desc: tStatic('realpay.m_toast_pledge_desc', { code: p.code, amount: formatTL(p.amount) }),
          });
        }
      }
    }
    seen.current = new Set(server.map((p) => p.id));
    setPledges(server);
  }, [pushToast]);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeToPledges(() => void refresh());
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  if (!pledges) return null;
  // "Gönderildi" denenler önce, sonra en eski bekleyen.
  const pending = pledges
    .filter((p) => p.status === 'pending')
    .sort((a, b) => Number(!!b.sentAt) - Number(!!a.sentAt) || a.createdAt.localeCompare(b.createdAt));
  const settled = pledges.filter((p) => p.status === 'confirmed' || p.status === 'rejected').slice(0, 5);
  if (pending.length === 0 && settled.length === 0) return null;

  const decide = async (p: Pledge, received: boolean) => {
    const amount = formatTL(p.amount, locale);
    const question = received
      ? t('realpay.m_received_confirm', { code: p.code, amount })
      : t('realpay.m_not_received_confirm', { code: p.code });
    if (!confirm(question)) return;
    setBusyId(p.id);
    try {
      await resolvePledge(p.id, received);
    } catch {
      alert(t('realpay.m_resolve_failed'));
    }
    setBusyId(null);
    await Promise.all([refresh(), refreshMerchantDebts()]);
  };

  return (
    <section className="mb-6">
      {pending.length > 0 && (
        <>
          <div
            className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/15 px-4 py-3 text-sm font-semibold text-amber-100"
            role="status"
          >
            🔔 {t('realpay.m_banner', { n: pending.length })}
          </div>
          <h2 className="heading-lg mb-1">{t('realpay.m_incoming_title')}</h2>
          <p className="text-xs text-muted-c mb-3">{t('realpay.m_incoming_sub')}</p>
          <div className="grid gap-3 mb-4">
            {pending.map((p) => {
              const waited = daysWaiting(p);
              return (
              <div key={p.id} className={`glass p-4 border ${p.sentAt ? 'border-sky-400/50' : 'border-amber-400/30'}`}>
                {(p.sentAt || waited >= 2) && (
                  <div className="flex gap-2 flex-wrap mb-2 text-[11px] font-semibold">
                    {p.sentAt && (
                      <span className="px-2 py-0.5 rounded-full bg-sky-400/15 text-sky-200 border border-sky-400/40">
                        {t('realpay.m_sent_badge')}
                      </span>
                    )}
                    {waited >= 2 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-400/15 text-rose-200 border border-rose-400/40">
                        {t('realpay.m_waiting', { n: waited })}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xl font-extrabold tracking-widest text-amber-200 font-mono">{p.code}</span>
                  <span className="text-lg font-bold tabular-nums">{formatTL(p.amount, locale)}</span>
                  <span className="text-xs text-muted-c">
                    {p.method === 'havale' ? '🏦 ' : '🏪 '}
                    {t(p.method === 'havale' ? 'realpay.m_method_havale' : 'realpay.m_method_dukkan')}
                  </span>
                </div>
                <div className="text-sm text-muted-c mt-1 truncate">{p.debtTitle}</div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    className="btn btn-primary flex-1 !text-[13px]"
                    disabled={busyId === p.id}
                    onClick={() => void decide(p, true)}
                  >
                    ✅ {t('realpay.m_received')}
                  </button>
                  <button
                    type="button"
                    className="btn flex-1 !text-[13px]"
                    disabled={busyId === p.id}
                    onClick={() => void decide(p, false)}
                  >
                    {t('realpay.m_not_received')}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}
      {settled.length > 0 && (
        <details className="glass p-3">
          <summary className="text-sm font-semibold cursor-pointer">{t('realpay.m_recent_title')}</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {settled.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="truncate">
                  <span className="font-mono">{p.code}</span> · {p.debtTitle}
                </span>
                <span className={p.status === 'confirmed' ? 'text-emerald-300' : 'text-rose-300'}>
                  {formatTL(p.amount, locale)} · {t(`realpay.status_${p.status}`)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

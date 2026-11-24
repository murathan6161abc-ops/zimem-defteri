'use client';
// Vatandaşın esnafa doğrudan yaptığı gerçek ödemeler (ödeme kodları) ve durumları.
import { useCallback, useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n, tStatic } from '@/lib/i18n';
import { formatTL } from '@/lib/debts';
import { getCurrentUserId } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  cancelPledge,
  fetchMyPledges,
  fetchPledgePaymentDetails,
  markPledgeSent,
  subscribeToPledges,
  type Pledge,
  type PledgeStatus,
} from '@/lib/pledges';
import { PledgeInstructions } from '@/components/modals/RealPaymentModal';

const STATUS_STYLE: Record<PledgeStatus, string> = {
  pending: 'text-amber-200 bg-amber-400/10 border-amber-400/30',
  confirmed: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30',
  rejected: 'text-rose-300 bg-rose-400/10 border-rose-400/30',
  cancelled: 'text-muted-c bg-white/5 border-white/10',
};

export default function MyPledges() {
  const { t, locale } = useI18n();
  const pledges = useZimemStore((s) => s.myPledges);
  const setMyPledges = useZimemStore((s) => s.setMyPledges);
  const upsertMyPledge = useZimemStore((s) => s.upsertMyPledge);
  const pushToast = useZimemStore((s) => s.pushToast);
  const [mounted, setMounted] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const server = await fetchMyPledges(getCurrentUserId());
    if (!server) return;
    // Bekleyen bir ödeme onaylandıysa kullanıcıya haber ver.
    const before = new Map(useZimemStore.getState().myPledges.map((p) => [p.id, p.status]));
    for (const p of server) {
      if (before.get(p.id) === 'pending' && p.status === 'confirmed') {
        pushToast({ title: tStatic('realpay.toast_confirmed_title'), desc: tStatic('realpay.toast_confirmed_desc') });
      }
    }
    // Sunucu IBAN döndürmez; bu oturumda gösterilmişse korunur.
    const known = new Map(useZimemStore.getState().myPledges.map((p) => [p.id, p]));
    setMyPledges(server.map((p) => ({ ...p, iban: known.get(p.id)?.iban, accountHolder: known.get(p.id)?.accountHolder })));
  }, [pushToast, setMyPledges]);

  useEffect(() => {
    setMounted(true);
    if (!isSupabaseConfigured()) return;
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

  if (!mounted || pledges.length === 0) return null;
  // Bekleyenler önce, sonra en yeni 5 sonuçlanmış.
  const pending = pledges.filter((p) => p.status === 'pending');
  const settled = pledges.filter((p) => p.status !== 'pending').slice(0, 5);

  const toggle = async (p: Pledge) => {
    if (openId === p.id) {
      setOpenId(null);
      return;
    }
    setOpenId(p.id);
    if (p.method === 'havale' && !p.iban && isSupabaseConfigured()) {
      const details = await fetchPledgePaymentDetails(p.id);
      if (details) upsertMyPledge({ ...p, iban: details.iban, accountHolder: details.accountHolder });
    }
  };

  const markSent = async (p: Pledge) => {
    if (!confirm(t('realpay.sent_confirm', { code: p.code, amount: formatTL(p.amount, locale) }))) return;
    const sentAt = await markPledgeSent(p.id);
    if (sentAt) upsertMyPledge({ ...p, sentAt });
    else alert(t('realpay.sent_failed'));
  };

  const cancel = async (p: Pledge) => {
    if (!confirm(t('realpay.cancel_confirm', { code: p.code }))) return;
    if (await cancelPledge(p.id)) upsertMyPledge({ ...p, status: 'cancelled', resolvedAt: new Date().toISOString() });
    else alert(t('realpay.err_generic'));
  };

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h2 className="heading-lg">{t('realpay.mine_title')}</h2>
        <span className="text-xs text-muted-c">{t('realpay.mine_sub')}</span>
      </div>
      <div className="grid gap-2">
        {[...pending, ...settled].map((p) => (
          <div key={p.id} className="glass p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.debtTitle || '—'}</div>
                <div className="text-xs text-muted-c">
                  <span className="font-mono">{p.code}</span> · {formatTL(p.amount, locale)} ·{' '}
                  {t(p.method === 'havale' ? 'realpay.m_method_havale' : 'realpay.m_method_dukkan')}
                </div>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[p.status]}`}>
                {t(`realpay.status_${p.status}`)}
              </span>
            </div>
            {p.status === 'pending' && p.sentAt && (
              <div className="text-xs text-sky-300 mt-2">{t('realpay.sent_label')}</div>
            )}
            {p.status === 'pending' && (
              <div className="mt-2 flex gap-2 flex-wrap">
                <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => void toggle(p)} aria-expanded={openId === p.id}>
                  {p.method === 'havale' ? t('realpay.show_iban') : t('realpay.code_label')}
                </button>
                {p.method === 'havale' && !p.sentAt && (
                  <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20" onClick={() => void markSent(p)}>
                    {t('realpay.sent_btn')}
                  </button>
                )}
                {/* Gönderildi denen ödeme iptal edilemez: para esnafa ulaşmış olabilir. */}
                {!p.sentAt && (
                  <button type="button" className="text-xs px-3 py-1.5 rounded-lg text-muted-c hover:text-rose-300" onClick={() => void cancel(p)}>
                    {t('realpay.cancel')}
                  </button>
                )}
              </div>
            )}
            {p.status === 'rejected' && (
              <div className="text-xs text-rose-200/80 mt-2">{t('realpay.rejected_hint', { code: p.code })}</div>
            )}
            {p.status === 'pending' && openId === p.id && (
              <div className="mt-3">
                <PledgeInstructions pledge={p} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

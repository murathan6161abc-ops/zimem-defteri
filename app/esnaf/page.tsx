'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useZimemStore } from '@/store/useZimemStore';
import { tStatic, useI18n, type Locale } from '@/lib/i18n';
import { KIND_META, formatTL, iconOf, kindChipStyle, kindOf } from '@/lib/debts';
import { forgetLedgerRef, readLedgerRefs } from '@/lib/ledgerScan';
import { getSupabase } from '@/lib/supabase';
import { fetchMyMerchantDebts, subscribeToMyDebts } from '@/lib/supabaseDebts';

const DATE_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-US', ar: 'ar' };
const URGENCY_KEY = { 1: 'debt.low', 2: 'debt.medium', 3: 'debt.high' } as const;

function fmtDate(iso: string, locale: Locale) {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[locale], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EsnafHomePage() {
  const merchantDebts = useZimemStore((s) => s.merchantDebts);
  const removeDebt = useZimemStore((s) => s.removeMerchantDebt);
  const setMerchantDebts = useZimemStore((s) => s.setMerchantDebts);
  const applyMerchantDebtChange = useZimemStore((s) => s.applyMerchantDebtChange);
  const pushToast = useZimemStore((s) => s.pushToast);
  const profile = useZimemStore((s) => s.profile);
  const refreshMerchantDebts = useZimemStore((s) => s.refreshMerchantDebts);
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  // Taramadan gelen müşteri baş harfleri — yalnızca bu cihazda tutulur.
  const [refs, setRefs] = useState<Record<string, string>>({});
  useEffect(() => {
    setMounted(true);
    setRefs(readLedgerRefs());
    // Defter her açıldığında sunucuyla eşitlenir (başka cihazdan / taramadan eklenenler dahil).
    void refreshMerchantDebts();
  }, [refreshMerchantDebts]);

  // Defter sunucudan tazelenir ve hayırseverlerin ödemeleri anında yansır. Uygulama arka
  // plandan dönünce yeniden tazelenir: o arada kopan bağlantı olay kaçırmış olabilir.
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let active = true;
    let userId: string | null = null;
    let unsubscribe = () => {};

    const refresh = async () => {
      if (!userId) return;
      const debts = await fetchMyMerchantDebts(userId);
      if (active && debts) setMerchantDebts(debts);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    void (async () => {
      const { data } = await client.auth.getSession();
      // Oturum yoksa (AuthGate girişe yönlendirir) eldeki defter silinmesin.
      userId = data.session?.user.id ?? null;
      if (!active || !userId) return;
      await refresh();
      if (!active) return;
      unsubscribe = subscribeToMyDebts(userId, (debt) => {
        if (applyMerchantDebtChange(debt)) {
          pushToast({ title: tStatic('debt.toast_closed_title'), desc: debt.title });
        }
      });
      document.addEventListener('visibilitychange', onVisible);
    })();

    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [setMerchantDebts, applyMerchantDebtChange, pushToast]);

  const list = mounted ? merchantDebts : [];
  const open = list.filter((d) => !d.closed);
  const closed = list.filter((d) => d.closed);
  const totalOpen = open.reduce((sum, d) => sum + d.amount, 0);
  const totalClosed = closed.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="pt-6">
      <section className="glass-strong p-5 sm:p-7 mb-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="section-title">{t('merchant.panel')}</div>
          <h1 className="heading-xl">{profile?.shopName || t('merchant.default_book')}</h1>
          {profile?.city && (
            <div className="text-sm text-muted-c mt-1">📍 {profile.city}</div>
          )}
        </div>
        {/* Ana eylemler: defter taraması öne çıkar, tek borç elle eklenir */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <Link href="/esnaf/tara" className="action-tile action-tile-primary">
            <span className="action-tile-icon" aria-hidden>📷</span>
            <span className="min-w-0">
              <span className="block font-bold text-base">{t('merchant.scan_tile_title')}</span>
              <span className="block text-[13px] opacity-90">{t('merchant.scan_tile_desc')}</span>
            </span>
          </Link>
          <Link href="/esnaf/yeni" className="action-tile">
            <span className="action-tile-icon" aria-hidden>✍️</span>
            <span className="min-w-0">
              <span className="block font-bold text-base">{t('merchant.add_new')}</span>
              <span className="block text-[13px] text-muted-c">{t('merchant.add_tile_desc')}</span>
            </span>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-label">{t('merchant.open_debts')}</div>
          <div className="stat-value text-amber-300" suppressHydrationWarning>
            {open.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('merchant.open_amount')}</div>
          <div className="stat-value text-amber-300" suppressHydrationWarning>
            {formatTL(totalOpen, locale)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('merchant.closed')}</div>
          <div className="stat-value text-emerald-300" suppressHydrationWarning>
            {closed.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('merchant.granted')}</div>
          <div className="stat-value text-emerald-300" suppressHydrationWarning>
            {formatTL(totalClosed, locale)}
          </div>
        </div>
      </div>

      <h2 className="heading-lg mb-3">{t('merchant.open_debts')}</h2>
      {open.length === 0 ? (
        <div className="glass p-10 text-center mb-6">
          <div className="font-bold text-lg mb-1">{t('merchant.empty_title')}</div>
          <div className="text-sm text-muted-c mb-4">
            {t('merchant.empty_desc')}
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            <Link href="/esnaf/tara" className="btn">
              {t('merchant.scan_btn')}
            </Link>
            <Link href="/esnaf/yeni" className="btn btn-primary">
              {t('merchant.add_first')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 mb-6">
          {open.map((d) => {
            const kind = kindOf(d);
              const meta = KIND_META[kind];
            return (
              <div key={d.id} className="debt-card !cursor-default">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}55` }}
                >
                  {iconOf(d)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="category-chip" style={kindChipStyle(kind)}>
                      {meta.emoji} {t(`debt.kind_${kind}`)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-c">
                      <span className={`urgency-dot urgency-${d.urgency}`} />
                      {t(URGENCY_KEY[d.urgency])} {t('debt.urgency_suffix')}
                    </span>
                    <span className="text-xs text-muted-c">· {fmtDate(d.addedAt, locale)}</span>
                    {refs[d.id] && (
                      <span className="text-xs text-amber-200/90">· 🔒 {refs[d.id]}</span>
                    )}
                  </div>
                  <div className="font-semibold text-[15px] truncate">{d.title}</div>
                  <div className="text-xs text-muted-c truncate">{d.description}</div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <div className="font-bold text-lg text-amber-200 tabular-nums">{formatTL(d.amount, locale)}</div>
                  <button
                    type="button"
                    className="text-xs text-muted-c hover:text-red-400 transition"
                    onClick={() => {
                      if (!confirm(t('merchant.delete_confirm', { title: d.title }))) return;
                      void removeDebt(d.id).then((ok) => {
                        if (ok) forgetLedgerRef(d.id);
                        else alert(t('merchant.delete_failed'));
                      });
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="heading-lg mb-3 flex items-center gap-2">
            <span>{t('merchant.closed_debts')}</span>
            <span className="text-xs font-normal text-emerald-300">
              {t('merchant.by_donors')}
            </span>
          </h2>
          <div className="grid gap-3">
            {closed.map((d) => {
              const kind = kindOf(d);
              const meta = KIND_META[kind];
              return (
                <div key={d.id} className="debt-card !cursor-default opacity-70">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 grayscale"
                    style={{ background: `${meta.color}11` }}
                  >
                    {iconOf(d)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-c mb-1">
                      {t('merchant.closed_label')}
                      {d.closedAt && ` · ${fmtDate(d.closedAt, locale)}`}
                      {refs[d.id] && <span className="text-amber-200/90"> · {refs[d.id]}</span>}
                    </div>
                    <div className="font-semibold text-sm truncate line-through opacity-70">
                      {d.title}
                    </div>
                  </div>
                  <div className="font-bold text-emerald-300 tabular-nums">{formatTL(d.amount, locale)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

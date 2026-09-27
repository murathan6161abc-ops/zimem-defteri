'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n, type Locale } from '@/lib/i18n';
import { CATEGORY_META } from '@/lib/debts';
import { forgetLedgerRef, readLedgerRefs } from '@/lib/ledgerScan';

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
  const profile = useZimemStore((s) => s.profile);
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  // Taramadan gelen müşteri baş harfleri — yalnızca bu cihazda tutulur.
  const [refs, setRefs] = useState<Record<string, string>>({});
  useEffect(() => {
    setMounted(true);
    setRefs(readLedgerRefs());
  }, []);

  const list = mounted ? merchantDebts : [];
  const open = list.filter((d) => !d.closed);
  const closed = list.filter((d) => d.closed);
  const totalOpen = open.reduce((sum, d) => sum + d.amount, 0);
  const totalClosed = closed.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="pt-6">
      <section className="glass-strong p-7 mb-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="section-title">{t('merchant.panel')}</div>
            <h1 className="heading-xl">{profile?.shopName || t('merchant.default_book')}</h1>
            {profile?.city && (
              <div className="text-sm text-muted-c mt-1">📍 {profile.city}</div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/esnaf/tara" className="btn">
              {t('merchant.scan_btn')}
            </Link>
            <Link href="/esnaf/yeni" className="btn btn-primary">
              ➕ {t('merchant.add_new')}
            </Link>
          </div>
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
            {totalOpen} ₺
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
            {totalClosed} ₺
          </div>
        </div>
      </div>

      <h2 className="heading-lg mb-3">{t('merchant.open_debts')}</h2>
      {open.length === 0 ? (
        <div className="glass p-10 text-center mb-6">
          <div className="text-5xl mb-3">📒</div>
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
            const meta = CATEGORY_META[d.category];
            return (
              <div key={d.id} className="debt-card !cursor-default">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}55` }}
                >
                  {d.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`category-chip cat-${d.category}`}>
                      {meta.emoji} {t(`debt.cat_${d.category}`)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-c">
                      <span className={`urgency-dot urgency-${d.urgency}`} />
                      {t(URGENCY_KEY[d.urgency])} {t('debt.urgency_suffix')}
                    </span>
                    <span className="text-[11px] text-muted-c">· {fmtDate(d.addedAt, locale)}</span>
                    {refs[d.id] && (
                      <span className="text-[11px] text-amber-200/90">· 🔒 {refs[d.id]}</span>
                    )}
                  </div>
                  <div className="font-semibold text-[15px] truncate">{d.title}</div>
                  <div className="text-xs text-muted-c truncate">{d.description}</div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <div className="font-bold text-lg text-amber-200">{d.amount} ₺</div>
                  <button
                    type="button"
                    className="text-[11px] text-muted-c hover:text-red-400 transition"
                    onClick={() => {
                      if (!confirm(t('merchant.delete_confirm', { title: d.title }))) return;
                      void removeDebt(d.id).then((ok) => {
                        if (ok) forgetLedgerRef(d.id);
                        else alert(t('merchant.delete_failed'));
                      });
                    }}
                  >
                    🗑️ {t('common.delete')}
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
              const meta = CATEGORY_META[d.category];
              return (
                <div key={d.id} className="debt-card !cursor-default opacity-70">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 grayscale"
                    style={{ background: `${meta.color}11` }}
                  >
                    {d.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-c mb-1">
                      ✓ {t('merchant.closed_label')} · {d.closedAt && fmtDate(d.closedAt, locale)}
                      {refs[d.id] && <span className="text-amber-200/90"> · 🔒 {refs[d.id]}</span>}
                    </div>
                    <div className="font-semibold text-sm truncate line-through opacity-70">
                      {d.title}
                    </div>
                  </div>
                  <div className="font-bold text-emerald-300">{d.amount} ₺</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

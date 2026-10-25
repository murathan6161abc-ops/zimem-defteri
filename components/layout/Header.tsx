'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import LocaleSwitcher from './LocaleSwitcher';
import LogoMark from './LogoMark';

type Tab = { href: string; labelKey: string };

// Vatandaşın diğer sayfalarına (ağaç, rozetler, istatistik, WHO-5) Profil'den gidilir.
const VATANDAS_TABS: Tab[] = [
  { href: '/', labelKey: 'nav.zimem' },
  { href: '/analiz', labelKey: 'nav.analysis' },
  { href: '/liderlik', labelKey: 'nav.leaderboard' },
  { href: '/history', labelKey: 'nav.history' },
  { href: '/profil', labelKey: 'nav.profile' },
];

const ESNAF_TABS: Tab[] = [
  { href: '/esnaf', labelKey: 'nav.merchant_book' },
  { href: '/esnaf/yeni', labelKey: 'nav.add_debt' },
  { href: '/profil', labelKey: 'nav.profile' },
];

// Statik dışa aktarımda adresler sonda "/" ile gelir (trailingSlash).
function samePath(a: string, b: string) {
  const strip = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : p);
  return strip(a) === strip(b);
}

export default function Header() {
  const pathname = usePathname();
  const xp = useZimemStore((s) => s.xp);
  const profile = useZimemStore((s) => s.profile);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const role = mounted ? profile?.role : undefined;
  const tabs = role === 'esnaf' ? ESNAF_TABS : VATANDAS_TABS;
  const hideTabs = pathname.startsWith('/register') || !mounted || !profile;

  return (
    <header
      className="w-full sticky top-0 z-30 backdrop-blur-xl bg-black/40 border-b border-white/5"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-5 pt-3 pb-2 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={role === 'esnaf' ? '/esnaf' : '/'}
            className="flex items-center gap-2 sm:gap-3 no-underline text-inherit min-w-0"
          >
            <LogoMark />
            <div className="min-w-0">
              <div className="font-extrabold tracking-tight text-sm sm:text-base leading-tight">
                D-Zimem
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-c leading-tight truncate">
                {t('nav.tagline')}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LocaleSwitcher />
            {mounted && profile && (
              <Link
                href="/profil"
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all max-w-[120px] sm:max-w-[140px] truncate no-underline text-inherit"
                title={t('nav.profile')}
              >
                <span className="font-medium truncate">{profile.displayName}</span>
              </Link>
            )}
            {role !== 'esnaf' && (
              <div className="xp-badge !text-[11px] sm:!text-[13px] !px-2.5 sm:!px-3.5" suppressHydrationWarning>
                <span className="tabular-nums">{mounted ? xp : 0}</span> XP
              </div>
            )}
          </div>
        </div>

        {!hideTabs && (
          <nav className="-mx-3 sm:mx-0 mt-2 sm:mt-3 px-3 sm:px-0 flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible scrollbar-none">
            {tabs.map((tab) => {
              const active = samePath(pathname, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`tab-btn shrink-0 !text-[12px] sm:!text-[13px] !px-3 sm:!px-4 ${active ? 'active' : ''}`}
                >
                  {t(tab.labelKey)}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}

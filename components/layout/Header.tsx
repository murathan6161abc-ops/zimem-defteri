'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import LocaleSwitcher from './LocaleSwitcher';
import { ESNAF_TABS, VATANDAS_TABS, isNavHidden, isTabActive } from './navTabs';

// Telefonda sekmeler alttaki menüdedir (BottomNav); burada yalnızca sm ve üstünde görünür.

export default function Header() {
  const pathname = usePathname();
  const xp = useZimemStore((s) => s.xp);
  const profile = useZimemStore((s) => s.profile);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const role = mounted ? profile?.role : undefined;
  const tabs = role === 'esnaf' ? ESNAF_TABS : VATANDAS_TABS;
  const hideTabs = isNavHidden(pathname) || !mounted || !profile;

  return (
    <header
      className="w-full sticky top-0 z-30 backdrop-blur-xl bg-[#1d2436]/85 border-b border-white/10"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-5 py-2.5 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={role === 'esnaf' ? '/esnaf' : '/'}
            className="flex items-center gap-2 sm:gap-3 no-underline text-inherit min-w-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-blue-500 flex items-center justify-center text-base sm:text-lg shadow-lg shrink-0">
              <span>📖</span>
            </div>
            <div className="min-w-0">
              <div className="font-extrabold tracking-tight text-sm sm:text-base leading-tight">
                D-Zimem
              </div>
              <div className="hidden sm:block text-xs text-muted-c leading-tight truncate">
                {t('nav.tagline')}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LocaleSwitcher />
            {mounted && profile && (
              <Link
                href="/profil"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all max-w-[120px] sm:max-w-[140px] truncate no-underline text-inherit"
                title={t('nav.profile')}
              >
                <span>{role === 'esnaf' ? '🏪' : '🤝'}</span>
                <span className="font-medium truncate">{profile.displayName}</span>
              </Link>
            )}
            {mounted && profile && role !== 'esnaf' && (
              <div className="xp-badge !text-xs sm:!text-[13px] !px-2.5 sm:!px-3.5" suppressHydrationWarning>
                ⚡ <span>{mounted ? xp : 0}</span> XP
              </div>
            )}
          </div>
        </div>

        {!hideTabs && (
          <nav className="hidden sm:flex mt-3 items-center gap-1.5 flex-wrap">
            {tabs.map((tab) => {
              const active = isTabActive(pathname, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`tab-btn shrink-0 !text-[13px] sm:!text-[13px] !px-3 sm:!px-4 ${active ? 'active' : ''}`}
                >
                  <span aria-hidden>{tab.icon}</span>
                  <span>{t(tab.labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}

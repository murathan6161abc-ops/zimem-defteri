'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useScanStore } from '@/store/useScanStore';
import { useI18n } from '@/lib/i18n';
import { ESNAF_TABS, VATANDAS_TABS, isNavHidden, isTabActive } from './navTabs';

/**
 * Telefonda ekranın altına sabit ana menü: tüm sekmeler görünür, başparmakla erişilir.
 * Tablet/masaüstünde (sm ve üstü) gizlenir; orada üst başlıktaki sekmeler kullanılır.
 * Klavye açıkken (bir alana yazarken) gizlenir ki alanın üstünü kapatmasın.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const profile = useZimemStore((s) => s.profile);
  // Tara sekmesi rozeti: süren okuma ya da incelenmeyi bekleyen borçlar
  const scanRunning = useScanStore((s) => s.jobs.length);
  const scanWaiting = useScanStore((s) => s.rows.length);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [typing, setTyping] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable ||
        (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file', 'range'].includes((el as HTMLInputElement).type)));
    const onIn = (e: FocusEvent) => setTyping(isField(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  const visible = mounted && !!profile && !isNavHidden(pathname);

  // Sayfa içeriği ve bildirimler menünün altında kalmasın.
  useEffect(() => {
    document.body.classList.toggle('has-bottom-nav', visible);
    return () => document.body.classList.remove('has-bottom-nav');
  }, [visible]);

  if (!visible) return null;
  const tabs = profile?.role === 'esnaf' ? ESNAF_TABS : VATANDAS_TABS;

  return (
    <nav
      aria-label={t('nav.main_menu')}
      className={`bottom-nav sm:hidden ${typing ? 'bottom-nav-hidden' : ''}`}
    >
      {tabs.map((tab) => {
        const active = isTabActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`bottom-nav-item ${active ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon" aria-hidden>
              {tab.icon}
              {tab.href === '/esnaf/tara' && (scanRunning > 0 || scanWaiting > 0) && (
                <span className={`bottom-nav-badge ${scanRunning > 0 ? 'running' : ''}`}>
                  {scanRunning > 0 ? '' : scanWaiting > 9 ? '9+' : scanWaiting}
                </span>
              )}
            </span>
            <span className="bottom-nav-label">{t(tab.shortKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

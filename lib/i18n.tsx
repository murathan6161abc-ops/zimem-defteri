'use client';
// Küçük bir çeviri katmanı: Türkçe (varsayılan), İngilizce ve Arapça. Arapçada sayfa
// yönü sağdan sola çevrilir (html[dir=rtl]).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import tr, { type Dict } from './locales/tr';
import en from './locales/en';
import ar from './locales/ar';

export type Locale = 'tr' | 'en' | 'ar';

const DICTIONARIES: Record<Locale, Dict> = { tr, en, ar };
const STORAGE_KEY = 'd-zimem-locale';

export const LOCALE_META: Record<Locale, { label: string; flag: string; dir: 'ltr' | 'rtl' }> = {
  tr: { label: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  en: { label: 'English', flag: '🇬🇧', dir: 'ltr' },
  ar: { label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
};

interface I18nContextValue {
  locale: Locale;
  dict: Dict;
  setLocale: (l: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// t('debt.full_pay') → sözlükteki değer; bulunamazsa anahtarın kendisi
function getByPath(obj: unknown, path: string): string {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === 'string' ? cur : path;
}

// '{days} gün sonra' + { days: 3 } → '3 gün sonra'
function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('tr');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && stored in DICTIONARIES) setLocaleState(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_META[locale].dir;
  }, [locale, mounted]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  };

  const dict = DICTIONARIES[locale];
  const t = (path: string, vars?: Record<string, string | number>) =>
    interpolate(getByPath(dict, path), vars);

  return (
    <I18nContext.Provider value={{ locale, dict, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Sağlayıcı dışında Türkçe kullanılır.
    const t = (p: string, vars?: Record<string, string | number>) =>
      interpolate(getByPath(tr, p), vars);
    return { locale: 'tr', dict: tr, setLocale: () => {}, t };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}

// React dışından (ör. store'daki bildirimler) çeviri: dili localStorage'dan okur,
// okunamazsa Türkçe kullanır.
export function tStatic(path: string, vars?: Record<string, string | number>): string {
  let loc: Locale = 'tr';
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && stored in DICTIONARIES) loc = stored;
  } catch {}
  return interpolate(getByPath(DICTIONARIES[loc], path), vars);
}

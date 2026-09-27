'use client';
import { useState, useEffect, useRef } from 'react';
import { useI18n, LOCALE_META, type Locale } from '@/lib/i18n';

export default function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!mounted) return null;

  const current = LOCALE_META[locale];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs"
        aria-label="Language selector"
        title={current.label}
      >
        <span className="text-sm leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <span className="text-muted-c text-[10px]">▼</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden">
          {(Object.entries(LOCALE_META) as [Locale, typeof current][]).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setLocale(key);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors text-left ${
                key === locale ? 'bg-amber-500/10 text-amber-200' : ''
              }`}
            >
              <span>{meta.flag}</span>
              <span>{meta.label}</span>
              {key === locale && <span className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';
import { useZimemStore } from '@/store/useZimemStore';
import { getLevelInfo } from '@/lib/levels';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState } from 'react';

/** İyilik puanı, seviye ve (withStats ile) bağış/kapanan borç/seri/iyilik sayıları — tek kartta. */
export default function ScoreBoard({ withStats = false }: { withStats?: boolean }) {
  const xp = useZimemStore((s) => s.xp);
  const totalDonated = useZimemStore((s) => s.totalDonated);
  const debtsPaid = useZimemStore((s) => s.debtsPaid);
  const streak = useZimemStore((s) => s.streak);
  const deeds = useZimemStore((s) => s.history.length);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const displayXP = mounted ? xp : 0;
  const { current, next, progress, remaining } = getLevelInfo(displayXP);
  const safe = (v: number) => (mounted ? v : 0);
  const stats = [
    { label: t('score.total_donated'), value: `${safe(totalDonated)} ₺`, accent: 'text-emerald-300' },
    { label: t('score.debts_closed'), value: safe(debtsPaid), accent: 'text-sky-300' },
    { label: t('score.streak'), value: `${safe(streak)} 🔥`, accent: 'text-orange-300' },
    { label: t('score.deeds'), value: safe(deeds), accent: 'text-amber-300' },
  ];

  return (
    <section className="glass-strong p-4 sm:p-7 mb-4 sm:mb-6 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-12 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="section-title">{t('score.points')}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl sm:text-5xl font-extrabold tracking-tight text-amber-300" suppressHydrationWarning>
              {displayXP}
            </span>
            <span className="text-muted-c font-semibold text-sm sm:text-base">{t('score.xp')}</span>
          </div>
        </div>

        <div className="text-right min-w-0">
          <div className="section-title">{t('score.level')}</div>
          <div className="font-bold text-sm sm:text-lg truncate">{t(`levels.${current.key}`)}</div>
          {next && (
            <div className="text-xs sm:text-xs text-muted-c mt-0.5 truncate">
              {t('score.to_next', { level: t(`levels.${next.key}`), xp: remaining })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 sm:mt-5">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {withStats && (
        <div className="relative grid grid-cols-4 mt-4 pt-4 border-t border-white/10">
          {stats.map((c, i) => (
            <div key={c.label} className={`min-w-0 text-center px-1 ${i > 0 ? 'border-s border-white/10' : ''}`}>
              <div className={`text-base sm:text-xl font-bold ${c.accent} truncate`} suppressHydrationWarning>
                {c.value}
              </div>
              <div className="text-xs text-muted-c leading-tight mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

'use client';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { formatTL } from '@/lib/debts';
import { useEffect, useState } from 'react';

export default function StatGrid() {
  const totalDonated = useZimemStore((s) => s.totalDonated);
  const debtsPaid = useZimemStore((s) => s.debtsPaid);
  const streak = useZimemStore((s) => s.streak);
  // Kısmi katkılar da sayılır; kapanan borç sayısından bu yüzden farklıdır.
  const deeds = useZimemStore((s) => s.history.length);
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const safe = (v: number) => (mounted ? v : 0);

  const cards = [
    { label: t('score.total_donated'), value: formatTL(safe(totalDonated), locale), accent: 'text-emerald-300' },
    { label: t('score.debts_closed'), value: safe(debtsPaid), accent: 'text-blue-300' },
    { label: t('score.streak'), value: t('score.streak_days', { n: safe(streak) }), accent: 'text-orange-300' },
    { label: t('score.deeds'), value: safe(deeds), accent: 'text-amber-300' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
      {cards.map((c) => (
        <div key={c.label} className="stat-card min-w-0">
          <div className="stat-label">{c.label}</div>
          <div className={`stat-value ${c.accent} truncate`} suppressHydrationWarning>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

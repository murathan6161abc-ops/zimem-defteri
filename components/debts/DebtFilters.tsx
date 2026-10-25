'use client';
import type { Category } from '@/types';
import { CATEGORIES } from '@/lib/debts';
import { useI18n } from '@/lib/i18n';

export default function DebtFilters({
  active,
  onChange,
}: {
  active: Category | 'all';
  onChange: (v: Category | 'all') => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {(['all', ...CATEGORIES] as const).map((key) => (
        <button
          key={key}
          className={`tab-btn ${active === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
          type="button"
        >
          {key !== 'all' && <span className={`urgency-dot dot-${key}`} aria-hidden />}
          <span>{t(`debt.cat_${key}`)}</span>
        </button>
      ))}
    </div>
  );
}

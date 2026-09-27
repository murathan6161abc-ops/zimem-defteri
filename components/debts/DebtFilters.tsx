'use client';
import type { Category } from '@/types';
import { CATEGORY_META } from '@/lib/debts';
import { useI18n } from '@/lib/i18n';

const CATEGORIES: { key: Category | 'all'; emoji: string }[] = [
  { key: 'all', emoji: '📋' },
  { key: 'gida', emoji: CATEGORY_META.gida.emoji },
  { key: 'egitim', emoji: CATEGORY_META.egitim.emoji },
  { key: 'fatura', emoji: CATEGORY_META.fatura.emoji },
  { key: 'saglik', emoji: CATEGORY_META.saglik.emoji },
];

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
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          className={`tab-btn ${active === c.key ? 'active' : ''}`}
          onClick={() => onChange(c.key)}
          type="button"
        >
          <span>{c.emoji}</span>
          <span>{t(c.key === 'all' ? 'debt.cat_all' : `debt.cat_${c.key}`)}</span>
        </button>
      ))}
    </div>
  );
}

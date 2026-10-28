'use client';
import type { DebtKind } from '@/types';
import { DEBT_KINDS, KIND_META } from '@/lib/debts';
import { useI18n } from '@/lib/i18n';

/**
 * Tür filtreleri: yalnızca havuzda borcu olan türler (sayısıyla) gösterilir;
 * tek satırda yana kaydırılır ki telefonda ekranı kaplamasın.
 */
export default function DebtFilters({
  active,
  onChange,
  counts,
}: {
  active: DebtKind | 'all';
  onChange: (v: DebtKind | 'all') => void;
  counts: Partial<Record<DebtKind, number>>;
}) {
  const { t } = useI18n();
  const kinds = DEBT_KINDS.filter((k) => (counts[k] ?? 0) > 0 || k === active);
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  return (
    <div className="-mx-3 px-3 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-4">
      <button
        className={`tab-btn shrink-0 ${active === 'all' ? 'active' : ''}`}
        onClick={() => onChange('all')}
        type="button"
      >
        <span aria-hidden>📋</span>
        <span>{t('debt.cat_all')}</span>
        {total > 0 && <span className="opacity-70">{total}</span>}
      </button>
      {kinds.map((k) => (
        <button
          key={k}
          className={`tab-btn shrink-0 ${active === k ? 'active' : ''}`}
          style={active === k ? { borderColor: `${KIND_META[k].color}99`, background: `${KIND_META[k].color}26` } : undefined}
          onClick={() => onChange(k)}
          type="button"
        >
          <span aria-hidden>{KIND_META[k].emoji}</span>
          <span>{t(`debt.kind_${k}`)}</span>
          <span className="opacity-70">{counts[k] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

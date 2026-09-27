'use client';
import { useState } from 'react';
import IyilikTree from '@/components/tree/IyilikTree';
import ScoreBoard from '@/components/layout/ScoreBoard';
import type { Category } from '@/types';
import { CATEGORY_META } from '@/lib/debts';
import { useI18n } from '@/lib/i18n';

const FILTERS: { key: Category | 'all'; emoji: string }[] = [
  { key: 'all', emoji: '🌳' },
  { key: 'gida', emoji: CATEGORY_META.gida.emoji },
  { key: 'egitim', emoji: CATEGORY_META.egitim.emoji },
  { key: 'fatura', emoji: CATEGORY_META.fatura.emoji },
  { key: 'saglik', emoji: CATEGORY_META.saglik.emoji },
];

export default function TreePage() {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const { t } = useI18n();

  return (
    <div className="pt-6">
      <ScoreBoard />

      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h2 className="heading-lg">{t('tree.title')}</h2>
        <div className="text-xs text-muted-c">
          {t('tree.subtitle')}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`tab-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            <span>{f.emoji}</span>
            <span>{t(`debt.cat_${f.key}`)}</span>
          </button>
        ))}
      </div>

      <IyilikTree height={520} filter={filter} />

      <div className="mt-6 grid sm:grid-cols-3 gap-3 text-xs text-muted-c">
        <div className="glass p-4">
          <div className="font-semibold mb-1 text-white">🌱 0–50 XP</div>
          {t('tree.stage1_desc')}
        </div>
        <div className="glass p-4">
          <div className="font-semibold mb-1 text-white">💚 150–350 XP</div>
          {t('tree.stage2_desc')}
        </div>
        <div className="glass p-4">
          <div className="font-semibold mb-1 text-white">👑 600+ XP</div>
          {t('tree.stage3_desc')}
        </div>
      </div>
    </div>
  );
}

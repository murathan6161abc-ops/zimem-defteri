'use client';
import { useState } from 'react';
import IyilikTree from '@/components/tree/IyilikTree';
import ScoreBoard from '@/components/layout/ScoreBoard';
import DebtFilters from '@/components/debts/DebtFilters';
import type { Category } from '@/types';
import { useI18n } from '@/lib/i18n';

// Eşikler lib/tree.ts ile aynı: 150 XP'de yeni dallar, 350'de çiçek, 600'de meyve, 1000'de ışıltı.
const STAGES = [
  { range: '0–149 XP', key: 'tree.stage1_desc' },
  { range: '150–599 XP', key: 'tree.stage2_desc' },
  { range: '600+ XP', key: 'tree.stage3_desc' },
];

export default function TreePage() {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const { t } = useI18n();

  return (
    <div className="pt-6">
      <ScoreBoard />

      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h1 className="heading-lg">{t('tree.title')}</h1>
        <div className="text-xs text-muted-c">{t('tree.subtitle')}</div>
      </div>

      <DebtFilters active={filter} onChange={setFilter} />

      <IyilikTree height={520} filter={filter} />

      <div className="mt-6 grid sm:grid-cols-3 gap-3 text-xs text-muted-c">
        {STAGES.map((s) => (
          <div key={s.range} className="glass p-4">
            <div className="font-semibold mb-1 text-white tabular-nums">{s.range}</div>
            {t(s.key)}
          </div>
        ))}
      </div>
    </div>
  );
}

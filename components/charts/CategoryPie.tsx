'use client';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { CATEGORY_META } from '@/lib/debts';
import { useI18n } from '@/lib/i18n';
import type { Category } from '@/types';

const CATS: Category[] = ['gida', 'egitim', 'fatura', 'saglik'];

export default function CategoryPie() {
  const history = useZimemStore((s) => s.history);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const counts = CATS.map(
    (c) => (mounted ? history.filter((h) => h.category === c).length : 0),
  );
  const total = counts.reduce((a, b) => a + b, 0);

  const W = 200;
  const cx = W / 2;
  const r = 70;

  let offset = -Math.PI / 2;
  const arcs = CATS.map((cat, i) => {
    const value = counts[i];
    if (value === 0 || total === 0) return null;
    const angle = (value / total) * Math.PI * 2;
    const x1 = cx + Math.cos(offset) * r;
    const y1 = cx + Math.sin(offset) * r;
    const x2 = cx + Math.cos(offset + angle) * r;
    const y2 = cx + Math.sin(offset + angle) * r;
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cx} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    offset += angle;
    return <path key={cat} d={path} fill={CATEGORY_META[cat].color} opacity="0.85" />;
  });

  return (
    <div className="glass p-5">
      <div className="section-title">{t('stats.category_dist')}</div>
      <div className="flex items-center gap-4">
        <svg viewBox={`0 0 ${W} ${W}`} className="w-32 h-32 shrink-0">
          {total === 0 ? (
            <circle cx={cx} cy={cx} r={r} fill="rgba(255,255,255,0.06)" />
          ) : (
            arcs
          )}
          <circle cx={cx} cy={cx} r={r * 0.55} fill="#272f46" />
          <text
            x={cx}
            y={cx + 4}
            fill="#eceff6"
            textAnchor="middle"
            fontSize="22"
            fontWeight="700"
          >
            {total}
          </text>
          <text
            x={cx}
            y={cx + 20}
            fill="#b3bdd2"
            textAnchor="middle"
            fontSize="10"
          >
            {t('stats.deeds_unit')}
          </text>
        </svg>
        <ul className="flex-1 space-y-1.5">
          {CATS.map((c, i) => (
            <li
              key={c}
              className="flex items-center justify-between text-sm"
            >
              <span className="inline-flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: CATEGORY_META[c].color }}
                />
                <span className="text-muted-c">{t(`debt.cat_${c}`)}</span>
              </span>
              <span className="font-semibold">{counts[i]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

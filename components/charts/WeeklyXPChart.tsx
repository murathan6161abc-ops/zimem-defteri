'use client';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';

function weeklyBuckets(history: { date: string; xp: number }[], dayLabels: string[]) {
  const buckets = Array(7).fill(0) as number[];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const h of history) {
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) {
      buckets[6 - diff] += h.xp;
    }
  }
  // Map index 0..6 to actual day labels — shift so today is last
  const todayDay = (today.getDay() + 6) % 7; // Monday=0
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const idx = (todayDay - i + 7) % 7;
    labels.push(dayLabels[idx]);
  }
  return { buckets, labels };
}

export default function WeeklyXPChart() {
  const history = useZimemStore((s) => s.history);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dayLabels = [
    t('stats.d_mon'), t('stats.d_tue'), t('stats.d_wed'), t('stats.d_thu'),
    t('stats.d_fri'), t('stats.d_sat'), t('stats.d_sun'),
  ];
  const data = weeklyBuckets(mounted ? history : [], dayLabels);
  const max = Math.max(1, ...data.buckets);

  const W = 360;
  const H = 180;
  const barW = (W - 40) / 7 - 10;
  const padding = 20;

  return (
    <div className="glass p-5">
      <div className="section-title">{t('stats.weekly_xp')}</div>
      <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full h-auto">
        {/* grid */}
        {[0.25, 0.5, 0.75, 1].map((p, i) => (
          <line
            key={i}
            x1={padding}
            x2={W - padding}
            y1={H - p * (H - 20) + 10}
            y2={H - p * (H - 20) + 10}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 4"
          />
        ))}

        {data.buckets.map((v, i) => {
          const h = (v / max) * (H - 20);
          const x = padding + i * ((W - 40) / 7 + 0);
          const y = H - h + 10;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={5}
                fill="url(#barGrad)"
              />
              {v > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  fill="#fbbf24"
                  fontSize="10"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {v}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H + 24}
                fill="rgba(255,255,255,0.5)"
                fontSize="10"
                textAnchor="middle"
              >
                {data.labels[i]}
              </text>
            </g>
          );
        })}

        <defs>
          <linearGradient id="barGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

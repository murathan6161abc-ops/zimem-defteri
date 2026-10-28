'use client';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { buildTree } from '@/lib/tree';
import { CATEGORY_META } from '@/lib/debts';
import { useI18n } from '@/lib/i18n';
import type { Category } from '@/types';

export default function IyilikTree({
  height = 480,
  filter,
}: {
  height?: number;
  filter?: Category | 'all';
}) {
  const history = useZimemStore((s) => s.history);
  const xp = useZimemStore((s) => s.xp);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const safeHistory = mounted ? history : [];
  const safeXP = mounted ? xp : 0;
  const layout = buildTree(safeHistory, safeXP);

  const aspectW = 400;
  const aspectH = 480;

  return (
    <div
      className="glass-strong relative overflow-hidden"
      style={{ height, padding: 0 }}
    >
      {/* ambient sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/15 via-transparent to-emerald-500/10 pointer-events-none" />
      {layout.glow && (
        <div className="absolute inset-0 bg-amber-400/10 pointer-events-none animate-pulse" />
      )}

      <svg
        viewBox={`0 0 ${aspectW} ${aspectH}`}
        className="w-full h-full block"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          <radialGradient id="ground" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="trunk" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          {layout.glow && (
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* ground */}
        <ellipse cx="200" cy="430" rx="170" ry="22" fill="url(#ground)" />

        {/* branches */}
        <g
          stroke="url(#trunk)"
          fill="none"
          strokeLinecap="round"
          style={layout.glow ? { filter: 'url(#glow)' } : undefined}
        >
          {layout.branches.map((b, i) => (
            <path
              key={i}
              d={b.d}
              strokeWidth={b.width}
              style={{
                opacity: 0,
                animation: `fadeIn .6s ease ${i * 0.07}s forwards`,
              }}
            />
          ))}
        </g>

        {/* fruit (XP >= 600) */}
        {layout.fruit && (
          <g>
            {[
              [90, 200], [310, 200], [180, 150], [220, 150],
            ].map(([cx, cy], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="6"
                fill="#ef4444"
                opacity="0.85"
                style={{ animation: `leafGrow .8s ease ${i * 0.15}s both` }}
              />
            ))}
          </g>
        )}

        {/* leaves */}
        <g>
          {layout.leaves.map((leaf, i) => {
            const dim =
              filter && filter !== 'all' && leaf.category !== filter ? 0.18 : 1;
            if (leaf.bloom) {
              return (
                <g
                  key={leaf.id}
                  transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rotation})`}
                  opacity={dim}
                >
                  <g
                    style={{
                      transformOrigin: '0 0',
                      animation: `leafGrow .6s cubic-bezier(.16,.84,.44,1) ${i * 0.04}s both`,
                    }}
                  >
                    {[0, 72, 144, 216, 288].map((deg) => (
                      <ellipse
                        key={deg}
                        rx={leaf.size * 0.55}
                        ry={leaf.size * 0.32}
                        fill={leaf.color}
                        opacity="0.92"
                        transform={`rotate(${deg}) translate(${leaf.size * 0.5} 0)`}
                      />
                    ))}
                    <circle r={leaf.size * 0.35} fill="#fde68a" />
                  </g>
                </g>
              );
            }
            return (
              <g
                key={leaf.id}
                transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rotation})`}
                opacity={dim}
              >
                <g
                  style={{
                    transformOrigin: '0 0',
                    animation: `leafGrow .55s cubic-bezier(.16,.84,.44,1) ${i * 0.04}s both`,
                  }}
                >
                  <path
                    d={`M 0 0 Q ${leaf.size * 0.9} ${-leaf.size * 0.4} ${leaf.size * 1.6} 0 Q ${leaf.size * 0.9} ${leaf.size * 0.4} 0 0 Z`}
                    fill={leaf.color}
                    opacity="0.85"
                  />
                  <path
                    d={`M 0 0 L ${leaf.size * 1.6} 0`}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth="0.5"
                  />
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* legend */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-c">
        {(['gida', 'egitim', 'fatura', 'saglik'] as Category[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: CATEGORY_META[c].color }}
            />
            {t(`debt.cat_${c}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

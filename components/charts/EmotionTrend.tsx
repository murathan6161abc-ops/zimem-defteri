'use client';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';

export default function EmotionTrend() {
  const history = useZimemStore((s) => s.history);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const list = mounted ? history : [];

  const preCounts: Record<string, number> = {};
  const postCounts: Record<string, number> = {};
  for (const h of list) {
    preCounts[h.preEmotion] = (preCounts[h.preEmotion] || 0) + 1;
    postCounts[h.postEmotion] = (postCounts[h.postEmotion] || 0) + 1;
  }
  const total = list.length;

  return (
    <div className="glass p-5">
      <div className="section-title">{t('stats.emotion_journey')}</div>
      {total === 0 ? (
        <div className="text-sm text-muted-c text-center py-4">{t('stats.no_data')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <EmotionColumn
            title={t('stats.before_intent')}
            counts={preCounts}
            total={total}
            label={(k) => t(`pretest.emo_${k}`)}
            color="#a855f7"
          />
          <EmotionColumn
            title={t('stats.after_impact')}
            counts={postCounts}
            total={total}
            label={(k) => t(`posttest.emo_${k}`)}
            color="#10b981"
          />
        </div>
      )}
    </div>
  );
}

function EmotionColumn({
  title,
  counts,
  total,
  label,
  color,
}: {
  title: string;
  counts: Record<string, number>;
  total: number;
  label: (key: string) => string;
  color: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-c mb-2">{title}</div>
      <div className="space-y-1.5">
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="text-muted-c flex-1 truncate">{label(k)}</span>
              <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full" style={{ width: `${(v / total) * 100}%`, background: color }} />
              </div>
              <span className="font-semibold text-white w-5 text-end tabular-nums">{v}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';

const POST_EMOTION_EMOJI: Record<string, string> = {
  mutlu: '😊', dingin: '🌿', hafiflemis: '🕊️', gururlu: '🌟',
};

const PRE_EMOTION_EMOJI: Record<string, string> = {
  merak: '🤔', sorumluluk: '🛡️', huzur: '🕊️', heyecan: '✨',
};

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
        <div className="text-sm text-muted-c text-center py-4">
          {t('stats.no_data')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-c mb-2">{t('stats.before_intent')}</div>
            <div className="space-y-1.5">
              {Object.entries(preCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <Row
                    key={k}
                    emoji={PRE_EMOTION_EMOJI[k] || '•'}
                    label={t(`pretest.emo_${k}`)}
                    value={v}
                    total={total}
                    color="#a855f7"
                  />
                ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-c mb-2">{t('stats.after_impact')}</div>
            <div className="space-y-1.5">
              {Object.entries(postCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <Row
                    key={k}
                    emoji={POST_EMOTION_EMOJI[k] || '•'}
                    label={t(`posttest.emo_${k}`)}
                    value={v}
                    total={total}
                    color="#10b981"
                  />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  emoji,
  label,
  value,
  total,
  color,
}: {
  emoji: string;
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = (value / total) * 100;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-base">{emoji}</span>
      <span className="text-muted-c flex-1 truncate">{label}</span>
      <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="font-semibold text-white w-5 text-right">{value}</span>
    </div>
  );
}

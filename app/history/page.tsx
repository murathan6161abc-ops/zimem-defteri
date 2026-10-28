'use client';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { CATEGORY_META, KIND_META, formatTL, kindChipStyle } from '@/lib/debts';
import { useI18n } from '@/lib/i18n';

const POST_EMOJI: Record<string, string> = {
  mutlu: '😊', dingin: '🌿', hafiflemis: '🕊️', gururlu: '🌟',
};

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const history = useZimemStore((s) => s.history);
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const list = mounted ? history : [];

  return (
    <div className="pt-6">
      <h1 className="heading-lg mb-4">{t('history.title')}</h1>

      {list.length === 0 ? (
        <div className="glass p-10 text-center">
          <div className="font-bold text-lg mb-1">{t('history.empty_title')}</div>
          <div className="text-sm text-muted-c">{t('history.empty_desc')}</div>
        </div>
      ) : (
        <ol className="relative border-s-2 border-white/10 ms-3 space-y-4">
          {list.map((h) => {
            const meta = CATEGORY_META[h.category];
            // Türü biliniyorsa (bu cihazda ödenen) tür etiketi; yoksa araştırma grubu
            const kind = h.kind && KIND_META[h.kind] ? h.kind : null;
            return (
              <li key={h.id} className="ms-5 relative">
                <span
                  className="absolute -start-[34px] top-2 w-4 h-4 rounded-full border-2 border-white/30"
                  style={{ background: meta.color }}
                />
                <div className="glass p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {kind ? (
                        <span className="category-chip" style={kindChipStyle(kind)}>
                          {h.icon || KIND_META[kind].emoji} {t(`debt.kind_${kind}`)}
                        </span>
                      ) : (
                        <span className={`category-chip cat-${h.category}`}>
                          {meta.emoji} {t(`debt.cat_${h.category}`)}
                        </span>
                      )}
                      <span className="text-xs text-muted-c">{fmtDate(h.date, locale)}</span>
                    </div>
                    <div className="xp-badge text-xs">⚡ +{h.xp} XP</div>
                  </div>
                  <div className="font-semibold text-sm">{h.title}</div>
                  <div className="text-xs text-muted-c mt-1 flex items-center gap-2 flex-wrap">
                    <span>💰 {formatTL(h.amount, locale)}</span>
                    <span>·</span>
                    <span>{t('history.after_label')} {POST_EMOJI[h.postEmotion] || '•'} {t(`posttest.emo_${h.postEmotion}`)}</span>
                    {h.willRepeat === 'evet' && <span>· 🔁 {t('history.will_repeat')}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

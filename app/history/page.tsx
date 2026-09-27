'use client';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { CATEGORY_META } from '@/lib/debts';
import { useI18n } from '@/lib/i18n';

const POST_EMOJI: Record<string, string> = {
  mutlu: '😊', dingin: '🌿', hafiflemis: '🕊️', gururlu: '🌟',
};

function fmtDate(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, {
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
      <h2 className="heading-lg mb-4">{t('history.title')}</h2>

      {list.length === 0 ? (
        <div className="glass p-10 text-center">
          <div className="text-5xl mb-3">🕊️</div>
          <div className="font-bold text-lg mb-1">{t('history.empty_title')}</div>
          <div className="text-sm text-muted-c">
            {t('history.empty_desc')}
          </div>
        </div>
      ) : (
        <ol className="relative border-l-2 border-white/10 ml-3 space-y-4">
          {list.map((h) => {
            const meta = CATEGORY_META[h.category];
            return (
              <li key={h.id} className="ml-5 relative">
                <span
                  className="absolute -left-[34px] top-2 w-4 h-4 rounded-full border-2 border-white/30"
                  style={{ background: meta.color }}
                />
                <div className="glass p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`category-chip cat-${h.category}`}>
                        {meta.emoji} {t(`debt.cat_${h.category}`)}
                      </span>
                      <span className="text-xs text-muted-c">{fmtDate(h.date, locale)}</span>
                    </div>
                    <div className="xp-badge text-xs">⚡ +{h.xp} XP</div>
                  </div>
                  <div className="font-semibold text-sm">{h.title}</div>
                  <div className="text-xs text-muted-c mt-1 flex items-center gap-2 flex-wrap">
                    <span>💰 {h.amount} ₺</span>
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

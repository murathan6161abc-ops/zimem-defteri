'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { WHO5_ITEMS, who5Category, type WHO5Category } from '@/lib/scales';
import { submitWHO5, fetchMyWHO5History, daysUntilNextTest } from '@/lib/who5';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { WHO5Measurement } from '@/types';

export default function WellbeingPage() {
  const { t } = useI18n();
  const [history, setHistory] = useState<WHO5Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<WHO5Measurement | null>(null);

  async function loadHistory() {
    setLoading(true);
    const data = await fetchMyWHO5History(12);
    setHistory(data);
    setLoading(false);
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  const lockedDays = history.length > 0 ? daysUntilNextTest(history[0]) : 0;
  const isLocked = lockedDays > 0 && !justSubmitted;
  const allAnswered = WHO5_ITEMS.every((it) => scores[it.key] !== undefined);

  async function handleSubmit() {
    if (!allAnswered) return;
    setSubmitting(true);
    const result = await submitWHO5(scores);
    if (result) {
      setJustSubmitted(result);
      setHistory((prev) => [result, ...prev]);
      setScores({});
    }
    setSubmitting(false);
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="pt-6">
        <h1 className="heading-lg mb-3">{t('who5.title')}</h1>
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-sm text-muted-c">{t('who5.online_required')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-5">
      <div>
        <h1 className="heading-lg mb-1">🌿 {t('who5.title')}</h1>
        <p className="text-xs text-muted-c">{t('who5.subtitle')}</p>
        <p className="text-[10px] text-muted-c mt-1 opacity-70">
          {t('who5.scale_credit')}
        </p>
      </div>

      {/* Yeni test alanı veya kilit */}
      {isLocked ? (
        <div className="glass p-6 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <div className="text-sm font-semibold mb-1">{t('who5.next_test')}</div>
          <div className="text-xs text-muted-c">{t('who5.locked', { days: lockedDays })}</div>
        </div>
      ) : justSubmitted ? (
        <WHO5ResultCard measurement={justSubmitted} />
      ) : (
        <section className="glass p-4 sm:p-5">
          <div className="text-[11px] text-muted-c mb-4">{t('who5.instruction')}</div>
          <div className="space-y-4">
            {WHO5_ITEMS.map((item, i) => (
              <div key={item.key}>
                <div className="text-[13px] mb-2">
                  {i + 1}. {t(item.i18nKey)}
                </div>
                <div className="flex gap-1.5 justify-between">
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScores((p) => ({ ...p, [item.key]: v }))}
                      className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-all ${
                        scores[item.key] === v
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-black scale-105'
                          : 'bg-white/5 text-muted-c border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={!allAnswered || submitting}
            onClick={handleSubmit}
            className={`mt-5 w-full py-3 rounded-xl font-semibold transition-all ${
              !allAnswered || submitting
                ? 'bg-white/10 text-muted-c cursor-not-allowed'
                : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white hover:scale-[1.02]'
            }`}
          >
            {submitting ? t('common.loading') : t('profile.take_test')}
          </button>
        </section>
      )}

      {/* Geçmiş ölçümler */}
      {history.length > 0 && (
        <section className="glass p-4 sm:p-5">
          <h3 className="text-sm font-bold text-muted-c uppercase tracking-wider mb-3">
            📊 {t('who5.recent_measurements')}
          </h3>
          {loading ? (
            <div className="text-xs text-muted-c">{t('common.loading')}</div>
          ) : (
            <WHO5Chart measurements={history} />
          )}
        </section>
      )}
    </div>
  );
}

// ─── Sonuç Kartı ──────────────────────────────────────────────
function WHO5ResultCard({ measurement }: { measurement: WHO5Measurement }) {
  const { t } = useI18n();
  const cat = who5Category(measurement.total);
  // NOT: Tailwind sınıfları derleme sırasında statik taranır; `text-${x}` gibi
  // dinamik birleştirmeler purge edilir. Bu yüzden tam sınıf adları yazılır.
  const meta: Record<WHO5Category, { text: string; border: string; emoji: string; key: string }> = {
    high: { text: 'text-emerald-300', border: 'border-emerald-400/30', emoji: '🌟', key: 'who5.result_high' },
    mid: { text: 'text-amber-300', border: 'border-amber-400/30', emoji: '☀️', key: 'who5.result_mid' },
    low: { text: 'text-rose-300', border: 'border-rose-400/30', emoji: '🌧️', key: 'who5.result_low' },
  };
  const m = meta[cat];
  return (
    <section className={`glass p-6 text-center ${m.border}`}>
      <div className="text-5xl mb-2">{m.emoji}</div>
      <div className="text-xs text-muted-c uppercase tracking-wider mb-1">
        {t('who5.result')}
      </div>
      <div className={`text-4xl font-extrabold ${m.text} mb-2`}>
        {measurement.total}/100
      </div>
      <div className="text-sm text-white/90">{t(m.key)}</div>
    </section>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────
function WHO5Chart({ measurements }: { measurements: WHO5Measurement[] }) {
  const { locale } = useI18n();
  const reversed = [...measurements].reverse(); // soldan eski → yeni
  return (
    <div className="flex items-end justify-between gap-1.5 h-32 px-1">
      {reversed.map((m) => {
        const pct = (m.total / 100) * 100;
        const date = new Date(m.created_at);
        const dayLabel = date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
        const colorClass =
          m.total >= 71 ? 'from-emerald-400 to-emerald-600'
          : m.total >= 51 ? 'from-amber-400 to-amber-600'
          : 'from-rose-400 to-rose-600';
        return (
          <div key={m.id} className="flex-1 flex flex-col items-center gap-1" title={`${m.total}/100`}>
            <div className="text-[9px] text-muted-c">{m.total}</div>
            <div
              className={`w-full rounded-t-sm bg-gradient-to-t ${colorClass} transition-all`}
              style={{ height: `${Math.max(8, pct)}%` }}
            />
            <div className="text-[9px] text-muted-c whitespace-nowrap">{dayLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

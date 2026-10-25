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
  const [error, setError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState<WHO5Measurement | null>(null);

  useEffect(() => {
    void fetchMyWHO5History(12).then((data) => {
      setHistory(data);
      setLoading(false);
    });
  }, []);

  const lockedDays = history.length > 0 ? daysUntilNextTest(history[0]) : 0;
  const isLocked = lockedDays > 0 && !justSubmitted;
  const allAnswered = WHO5_ITEMS.every((it) => scores[it.key] !== undefined);

  async function handleSubmit() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError('');
    const result = await submitWHO5(scores);
    if (result) {
      setJustSubmitted(result);
      setHistory((prev) => [result, ...prev]);
      setScores({});
    } else {
      setError(t('who5.save_error'));
    }
    setSubmitting(false);
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="pt-6">
        <h1 className="heading-lg mb-3">{t('who5.title')}</h1>
        <div className="glass p-8 text-center text-sm text-muted-c">{t('who5.online_required')}</div>
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-5">
      <div>
        <h1 className="heading-lg mb-1">{t('who5.title')}</h1>
        <p className="text-xs text-muted-c">{t('who5.subtitle')}</p>
        <p className="text-[10px] text-muted-c mt-1 opacity-70">{t('who5.scale_credit')}</p>
      </div>

      {loading ? (
        <div className="glass p-6 text-center text-sm text-muted-c">{t('common.loading')}</div>
      ) : isLocked ? (
        <div className="glass p-6 text-center">
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
                <div className="flex gap-1.5 justify-between" role="radiogroup" aria-label={t(item.i18nKey)}>
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={scores[item.key] === v}
                      onClick={() => setScores((p) => ({ ...p, [item.key]: v }))}
                      className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${
                        scores[item.key] === v
                          ? 'bg-emerald-400 text-black'
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

          {error && (
            <div className="mt-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" role="alert">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={!allAnswered || submitting}
            onClick={() => void handleSubmit()}
            className="btn btn-primary w-full mt-5"
          >
            {submitting ? t('common.loading') : t('profile.take_test')}
          </button>
        </section>
      )}

      {history.length > 0 && (
        <section className="glass p-4 sm:p-5">
          <h2 className="section-title">{t('who5.recent_measurements')}</h2>
          <WHO5Chart measurements={history} />
        </section>
      )}
    </div>
  );
}

// Tailwind sınıfları derlemede statik taranır; `text-${x}` gibi birleştirilmiş adlar
// çıktıya girmez, bu yüzden tam sınıf adları yazılır.
const CATEGORY_STYLE: Record<WHO5Category, { text: string; border: string; key: string }> = {
  high: { text: 'text-emerald-300', border: 'border-emerald-400/30', key: 'who5.result_high' },
  mid: { text: 'text-amber-300', border: 'border-amber-400/30', key: 'who5.result_mid' },
  low: { text: 'text-rose-300', border: 'border-rose-400/30', key: 'who5.result_low' },
};

function WHO5ResultCard({ measurement }: { measurement: WHO5Measurement }) {
  const { t } = useI18n();
  const m = CATEGORY_STYLE[who5Category(measurement.total)];
  return (
    <section className={`glass p-6 text-center ${m.border}`}>
      <div className="text-xs text-muted-c uppercase tracking-wider mb-1">{t('who5.result')}</div>
      <div className={`text-4xl font-extrabold ${m.text} mb-2 tabular-nums`}>{measurement.total}/100</div>
      <div className="text-sm text-white/90">{t(m.key)}</div>
    </section>
  );
}

function WHO5Chart({ measurements }: { measurements: WHO5Measurement[] }) {
  const { locale } = useI18n();
  const oldestFirst = [...measurements].reverse();
  return (
    <div className="flex items-end justify-between gap-1.5 h-32 px-1">
      {oldestFirst.map((m) => {
        const dayLabel = new Date(m.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
        const colorClass = m.total >= 71 ? 'bg-emerald-400/80' : m.total >= 51 ? 'bg-amber-400/80' : 'bg-rose-400/80';
        return (
          <div key={m.id} className="flex-1 flex flex-col items-center gap-1" title={`${m.total}/100`}>
            <div className="text-[9px] text-muted-c tabular-nums">{m.total}</div>
            <div className={`w-full rounded-t-sm ${colorClass} transition-all`} style={{ height: `${Math.max(8, m.total)}%` }} />
            <div className="text-[9px] text-muted-c whitespace-nowrap">{dayLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

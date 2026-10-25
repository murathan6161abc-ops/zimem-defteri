'use client';
import { useEffect, useState } from 'react';
import {
  fetchMySurveyResults,
  aggregateHuzurStats,
  type SurveyResult,
  type HuzurStats,
} from '@/lib/analytics';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { formatTL } from '@/lib/debts';

export default function AnalizPage() {
  const [results, setResults] = useState<SurveyResult[]>([]);
  const [stats, setStats] = useState<HuzurStats | null>(null);
  const [loading, setLoading] = useState(true);

  const xp = useZimemStore((s) => s.xp);
  const debtsPaid = useZimemStore((s) => s.debtsPaid);
  const totalDonated = useZimemStore((s) => s.totalDonated);
  const streak = useZimemStore((s) => s.streak);
  const { t, locale } = useI18n();

  useEffect(() => {
    async function load() {
      const data = await fetchMySurveyResults();
      setResults(data);
      setStats(aggregateHuzurStats(data));
      setLoading(false);
    }
    void load();
  }, []);

  if (!isSupabaseConfigured()) {
    return (
      <div className="pt-6">
        <h1 className="heading-lg mb-3">{t('analysis.offline_title')}</h1>
        <div className="glass p-8 text-center text-sm text-muted-c">{t('analysis.offline')}</div>
      </div>
    );
  }

  const preWidth = stats ? (stats.avgPre / 10) * 100 : 0;
  const postWidth = stats ? (stats.avgPost / 10) * 100 : 0;
  const improved = stats ? stats.change > 0 : false;

  const totalEmotions = stats ? Object.values(stats.emotionCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="pt-6 space-y-5">
      <div>
        <h1 className="heading-lg mb-1">{t('analysis.title')}</h1>
        <p className="text-xs text-muted-c">{t('analysis.subtitle', { n: Math.min(results.length, 10) })}</p>
      </div>

      {loading ? (
        <div className="glass p-10 text-center text-sm text-muted-c">{t('common.loading')}</div>
      ) : !stats || results.length === 0 ? (
        <div className="glass p-10 text-center">
          <div className="font-bold text-lg mb-1">{t('analysis.empty_title')}</div>
          <div className="text-sm text-muted-c max-w-xs mx-auto">{t('analysis.empty_desc')}</div>
        </div>
      ) : (
        <>
          {stats.count > 0 && (
            <section className="glass p-4 sm:p-5">
              <h2 className="section-title">{t('analysis.huzur_section')}</h2>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-c">{t('analysis.before')}</span>
                    <span className="text-xs font-bold text-slate-300 tabular-nums">{stats.avgPre.toFixed(1)}/10</span>
                  </div>
                  <div className="h-7 rounded-lg bg-white/5 overflow-hidden">
                    <div className="h-full bg-slate-400/80 transition-all duration-1000" style={{ width: `${preWidth}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-c">{t('analysis.after')}</span>
                    <span className="text-xs font-bold text-emerald-300 tabular-nums">{stats.avgPost.toFixed(1)}/10</span>
                  </div>
                  <div className="h-7 rounded-lg bg-white/5 overflow-hidden">
                    <div className="h-full bg-emerald-400/80 transition-all duration-1000" style={{ width: `${postWidth}%` }} />
                  </div>
                </div>
              </div>

              <p
                className={`mt-4 p-3 rounded-lg text-sm ${
                  improved
                    ? 'bg-emerald-500/10 border border-emerald-400/20 text-emerald-200'
                    : 'bg-white/5 border border-white/10 text-muted-c'
                }`}
              >
                {improved ? t('analysis.improved', { change: stats.change.toFixed(1) }) : t('analysis.not_improved')}
              </p>
            </section>
          )}

          {totalEmotions > 0 && (
            <section className="glass p-4 sm:p-5">
              <h2 className="section-title">{t('analysis.emotions_section')}</h2>
              <div className="space-y-2.5">
                {Object.entries(stats.emotionCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([emotion, count]) => {
                    const pct = Math.round((count / totalEmotions) * 100);
                    return (
                      <div key={emotion} className="flex items-center gap-3">
                        <span className="text-xs w-24 shrink-0">{t(`posttest.emo_${emotion}`)}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full bg-emerald-400/80 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-emerald-300 w-10 text-end tabular-nums">%{pct}</span>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard value={results.length} label={t('analysis.total_deeds')} color="text-amber-300" />
            <SummaryCard value={debtsPaid} label={t('score.debts_closed')} color="text-emerald-300" />
            <SummaryCard value={formatTL(totalDonated, locale)} label={t('analysis.total_contribution')} color="text-blue-300" />
            <SummaryCard value={t('score.streak_days', { n: streak })} label={t('profile.streak')} color="text-amber-300" />
          </section>

          <div className="text-center text-[11px] text-muted-c">
            {t('analysis.total_xp')}: {xp.toLocaleString(locale)}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="glass p-3 text-center">
      <div className={`text-xl font-extrabold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase text-muted-c tracking-wider mt-1">{label}</div>
    </div>
  );
}

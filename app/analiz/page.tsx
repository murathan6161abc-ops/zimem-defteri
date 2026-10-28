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

const EMOTION_EMOJI: Record<string, string> = {
  mutlu: '😊',
  dingin: '🌿',
  hafiflemis: '🕊️',
  gururlu: '🌟',
};

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
        <h1 className="heading-lg mb-3 flex items-center gap-2"><span aria-hidden>🧠</span><span>{t('analysis.offline_title')}</span></h1>
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-sm text-muted-c">
            {t('analysis.offline')}
          </p>
        </div>
      </div>
    );
  }

  const preWidth = stats ? (stats.avgPre / 10) * 100 : 0;
  const postWidth = stats ? (stats.avgPost / 10) * 100 : 0;
  const improved = stats ? stats.change > 0 : false;

  const totalEmotions =
    stats && Object.keys(stats.emotionCounts).length > 0
      ? Object.values(stats.emotionCounts).reduce((a, b) => a + b, 0)
      : 0;

  return (
    <div className="pt-6 space-y-5">
      <div>
        <h1 className="heading-lg mb-1 flex items-center gap-2"><span aria-hidden>🧠</span><span>{t('analysis.title')}</span></h1>
        <p className="text-xs text-muted-c">
          {t('analysis.subtitle', { n: Math.min(results.length, 10) })}
        </p>
      </div>

      {loading ? (
        <div className="glass p-10 text-center">
          <div className="text-3xl mb-2">⏳</div>
          <div className="text-sm text-muted-c">{t('common.loading')}</div>
        </div>
      ) : !stats || stats.count === 0 ? (
        <div className="glass p-10 text-center">
          <div className="text-5xl mb-3">🧘</div>
          <div className="font-bold text-lg mb-1">{t('analysis.empty_title')}</div>
          <div className="text-sm text-muted-c max-w-xs mx-auto">
            {t('analysis.empty_desc')}
          </div>
        </div>
      ) : (
        <>
          {/* Huzur Seviyesi Değişimi */}
          <section className="glass p-4 sm:p-5">
            <h2 className="text-sm font-bold text-muted-c uppercase tracking-wider mb-4">
              📊 {t('analysis.huzur_section')}
            </h2>

            <div className="space-y-3">
              {/* İyilik Öncesi */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-c">{t('analysis.before')}</span>
                  <span className="text-xs font-bold text-slate-300">
                    {stats.avgPre.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-7 rounded-lg bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-slate-500 to-slate-400 transition-all duration-1000"
                    style={{ width: `${preWidth}%` }}
                  />
                </div>
              </div>

              {/* İyilik Sonrası */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-c">{t('analysis.after')}</span>
                  <span className="text-xs font-bold text-emerald-300">
                    {stats.avgPost.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-7 rounded-lg bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-1000"
                    style={{ width: `${postWidth}%` }}
                  />
                </div>
              </div>
            </div>

            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                improved
                  ? 'bg-emerald-500/10 border border-emerald-400/20 text-emerald-200'
                  : 'bg-white/5 border border-white/10 text-muted-c'
              }`}
            >
              {improved ? (
                <>✨ {t('analysis.improved', { change: stats.change.toFixed(1) })}</>
              ) : (
                <>🌱 {t('analysis.not_improved')}</>
              )}
            </div>
          </section>

          {/* Duygu Dağılımı */}
          {totalEmotions > 0 && (
            <section className="glass p-4 sm:p-5">
              <h2 className="text-sm font-bold text-muted-c uppercase tracking-wider mb-4">
                💚 {t('analysis.emotions_section')}
              </h2>
              <div className="space-y-2.5">
                {Object.entries(stats.emotionCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([emotion, count]) => {
                    const pct = Math.round((count / totalEmotions) * 100);
                    return (
                      <div key={emotion} className="flex items-center gap-3">
                        <span className="text-xs w-24 shrink-0">
                          {EMOTION_EMOJI[emotion] || '💚'}{' '}
                          {t(`posttest.emo_${emotion}`)}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-300 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-emerald-300 w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Özet kartlar */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass p-3 text-center">
              <div className="text-xl font-extrabold text-amber-300">
                {results.length}
              </div>
              <div className="text-[11px] uppercase text-muted-c tracking-wider mt-1">
                {t('analysis.total_deeds')}
              </div>
            </div>
            <div className="glass p-3 text-center">
              <div className="text-xl font-extrabold text-emerald-300">
                {debtsPaid}
              </div>
              <div className="text-[11px] uppercase text-muted-c tracking-wider mt-1">
                {t('score.debts_closed')}
              </div>
            </div>
            <div className="glass p-3 text-center">
              <div className="text-xl font-extrabold text-blue-300">
                ₺{totalDonated.toLocaleString(locale)}
              </div>
              <div className="text-[11px] uppercase text-muted-c tracking-wider mt-1">
                {t('analysis.total_contribution')}
              </div>
            </div>
            <div className="glass p-3 text-center">
              <div className="text-xl font-extrabold text-amber-300">
                {streak} 🔥
              </div>
              <div className="text-[11px] uppercase text-muted-c tracking-wider mt-1">
                {t('profile.streak')}
              </div>
            </div>
          </section>

          <div className="text-center text-xs text-muted-c">
            ⚡ {t('analysis.total_xp')}: {xp.toLocaleString(locale)}
          </div>
        </>
      )}
    </div>
  );
}

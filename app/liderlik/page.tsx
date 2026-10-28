'use client';
import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry } from '@/lib/leaderboard';
import { isSupabaseConfigured } from '@/lib/supabase';
import { syncDeviceSnapshot } from '@/lib/sync';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';

export default function LiderlikPage() {
  const { t, locale } = useI18n();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const profile = useZimemStore((s) => s.profile);
  const xp = useZimemStore((s) => s.xp);
  const debtsPaid = useZimemStore((s) => s.debtsPaid);
  const totalDonated = useZimemStore((s) => s.totalDonated);
  const streak = useZimemStore((s) => s.streak);

  async function refresh() {
    setLoading(true);
    // Önce kendi snapshot'ını gönder ki listede güncel görünesin
    if (xp > 0) {
      await syncDeviceSnapshot({ profile, xp, debtsPaid, totalDonated, streak });
    }
    const data = await fetchLeaderboard();
    setLeaders(data);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSupabaseConfigured()) {
    return (
      <div className="pt-6">
        <h1 className="heading-lg mb-3 flex items-center gap-2"><span aria-hidden>🏆</span><span>{t('leaderboard.offline_title')}</span></h1>
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-sm text-muted-c">
            {t('leaderboard.offline_desc')}
          </p>
        </div>
      </div>
    );
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="heading-lg mb-1 flex items-center gap-2"><span aria-hidden>🏆</span><span>{t('leaderboard.title')}</span></h1>
          <p className="text-xs text-muted-c">
            {t('leaderboard.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          🔄 {t('common.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="glass p-10 text-center">
          <div className="text-3xl mb-2">⏳</div>
          <div className="text-sm text-muted-c">{t('common.loading')}</div>
        </div>
      ) : leaders.length === 0 ? (
        <div className="glass p-10 text-center">
          <div className="text-5xl mb-3">🌱</div>
          <div className="font-bold text-lg mb-1">{t('leaderboard.empty_title')}</div>
          <div className="text-sm text-muted-c">
            {t('leaderboard.empty_desc')}
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {leaders.map((u, i) => {
            const isMe = u.is_current;
            const medal = i < 3 ? medals[i] : null;
            return (
              <div
                key={u.participant_id}
                className={`glass p-3 sm:p-4 flex items-center gap-3 transition-all ${
                  isMe
                    ? 'border-amber-400/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                    : ''
                }`}
              >
                <div className="w-10 text-center text-xl shrink-0">
                  {medal ?? (
                    <span className="text-xs font-bold text-muted-c">#{i + 1}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm truncate">
                      {u.display_name || t('leaderboard.anon')}
                    </span>
                    {isMe && (
                      <span className="text-[11px] font-bold uppercase bg-gradient-to-br from-amber-500 to-amber-600 text-black px-1.5 py-0.5 rounded-full">
                        {t('leaderboard.you')}
                      </span>
                    )}
                    {u.role === 'esnaf' && (
                      <span className="text-[11px] text-blue-300">🏪</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-c">
                    {u.streak > 1 && <span>🔥 {u.streak} {t('leaderboard.streak_suffix')}</span>}
                    {u.debts_paid > 0 && <span>✅ {u.debts_paid} {t('leaderboard.debt_suffix')}</span>}
                    {u.city && <span>📍 {u.city}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-base text-amber-300">
                    {u.total_xp.toLocaleString(locale)}
                  </div>
                  <div className="text-[11px] text-muted-c uppercase">XP</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Kişisel anket analitiği — Huzur değişimi, duygu dağılımı
// survey_submissions tablosundan kullanıcının kendi verileri çekilir.
// ============================================================

import { getSupabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface SurveyResult {
  id: string;
  created_at: string;
  pre_huzur: number;
  pre_emotion: string;
  pre_likert: number;
  post_huzur: number | null;
  post_emotion: string;
  post_likert: number;
  will_repeat: string;
  xp_gained: number;
  debt_title: string;
  debt_category: string;
}

/**
 * Mevcut kullanıcının anket sonuçlarını çeker.
 */
export async function fetchMySurveyResults(): Promise<SurveyResult[]> {
  const client = getSupabase();
  if (!client) return [];

  const userId = getCurrentUserId();
  const { data, error } = await client
    .from('survey_submissions')
    .select(
      'id, created_at, pre_huzur, pre_emotion, pre_likert, post_huzur, post_emotion, post_likert, will_repeat, xp_gained, debt_title, debt_category',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('[analytics] fetchMySurveyResults hatası:', error.message);
    return [];
  }
  return (data || []) as SurveyResult[];
}

/**
 * LEGACY fallback — yalnızca post_huzur ölçümü eklenmeden ÖNCE kaydedilmiş
 * eski satırlar için. Yeni kayıtlarda post_huzur doğrudan ölçülür (Posttest'teki
 * 1-10 huzur sorusu). Eski satırlarda post_huzur null olduğundan grafik boş
 * kalmasın diye post_likert'tan tahmin ediyoruz.
 *   Likert 1 → -1, 2 → 0, 3 → +1, 4 → +2, 5 → +3
 */
export function computePostHuzur(preHuzur: number, postLikert: number): number {
  const offset = (postLikert || 3) - 2;
  return Math.max(1, Math.min(10, preHuzur + offset));
}

export interface HuzurStats {
  avgPre: number;
  avgPost: number;
  change: number;
  count: number;
  emotionCounts: Record<string, number>;
}

export function aggregateHuzurStats(results: SurveyResult[]): HuzurStats {
  if (results.length === 0) {
    return { avgPre: 0, avgPost: 0, change: 0, count: 0, emotionCounts: {} };
  }
  const recent = results.slice(0, 10); // son 10
  const preSum = recent.reduce((s, r) => s + (r.pre_huzur || 5), 0);
  // Ölçülmüş post_huzur varsa onu kullan; yoksa (eski kayıtlar) tahmine düş.
  const postSum = recent.reduce(
    (s, r) => s + (r.post_huzur ?? computePostHuzur(r.pre_huzur || 5, r.post_likert || 3)),
    0,
  );
  const avgPre = preSum / recent.length;
  const avgPost = postSum / recent.length;

  const emotionCounts: Record<string, number> = {};
  recent.forEach((r) => {
    if (r.post_emotion) {
      emotionCounts[r.post_emotion] = (emotionCounts[r.post_emotion] || 0) + 1;
    }
  });

  return {
    avgPre,
    avgPost,
    change: avgPost - avgPre,
    count: recent.length,
    emotionCounts,
  };
}

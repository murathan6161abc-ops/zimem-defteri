// Kişisel analiz: kullanıcının kendi anket kayıtlarından huzur değişimi ve duygu dağılımı.

import { getSupabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface SurveyResult {
  id: string;
  created_at: string;
  pre_huzur: number | null;
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

export interface HuzurStats {
  avgPre: number;
  avgPost: number;
  change: number;
  count: number;
  emotionCounts: Record<string, number>;
}

/**
 * Son 10 kaydın özeti. Huzur ortalamaları yalnızca hem ön hem son testte huzur puanı
 * ölçülmüş kayıtlardan hesaplanır; eski sürümlerden kalan, son test huzuru boş
 * kayıtlar için tahmin yapılmaz.
 */
export function aggregateHuzurStats(results: SurveyResult[]): HuzurStats {
  const recent = results.slice(0, 10);
  const paired = recent.filter((r) => r.pre_huzur != null && r.post_huzur != null);
  const avgPre = paired.length ? paired.reduce((s, r) => s + (r.pre_huzur as number), 0) / paired.length : 0;
  const avgPost = paired.length ? paired.reduce((s, r) => s + (r.post_huzur as number), 0) / paired.length : 0;

  const emotionCounts: Record<string, number> = {};
  for (const r of recent) {
    if (r.post_emotion) emotionCounts[r.post_emotion] = (emotionCounts[r.post_emotion] || 0) + 1;
  }

  return { avgPre, avgPost, change: avgPost - avgPre, count: paired.length, emotionCounts };
}

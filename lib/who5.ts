// WHO-5 İyilik Hali İndeksi — Supabase CRUD
// Haftalık takip için (7 gün cooldown önerisi).

import { getSupabase } from './supabase';
import { getCurrentUserId } from './auth';
import { who5Total } from './scales';
import type { AgeGroup } from './research';
import type { WHO5Measurement } from '@/types';

/** Yeni bir WHO-5 ölçümü kaydeder */
export async function submitWHO5(
  scores: Record<string, number>,
  ageGroup?: AgeGroup,
): Promise<WHO5Measurement | null> {
  const client = getSupabase();
  if (!client) return null;

  const total = who5Total(scores); // 0-100 normalize

  const { data, error } = await client
    .from('who5_measurements')
    .insert({
      user_id: getCurrentUserId(),
      scores,
      total,
      age_group: ageGroup ?? null,
    })
    .select()
    .single();

  if (error) {
    console.warn('[who5] submit hatası:', error.message);
    return null;
  }
  return data as WHO5Measurement;
}

/** Bu cihazın son N ölçümünü getirir (yeniden eskiye) */
export async function fetchMyWHO5History(limit = 12): Promise<WHO5Measurement[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('who5_measurements')
    .select('*')
    .eq('user_id', getCurrentUserId())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[who5] fetchHistory hatası:', error.message);
    return [];
  }
  return (data || []) as WHO5Measurement[];
}

/** Sonraki test ne zaman açılır? (7 gün cooldown) */
export function daysUntilNextTest(lastMeasurement: WHO5Measurement | null): number {
  if (!lastMeasurement) return 0;
  const last = new Date(lastMeasurement.created_at);
  const cooldownEnd = new Date(last.getTime() + 7 * 86400000);
  const now = new Date();
  if (now >= cooldownEnd) return 0;
  return Math.ceil((cooldownEnd.getTime() - now.getTime()) / 86400000);
}

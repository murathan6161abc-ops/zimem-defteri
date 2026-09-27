// ============================================================
// Liderlik tablosu — güvenli RPC üzerinden ilk 10 katılımcıyı çekme
// ============================================================

import { getSupabase } from './supabase';

export interface LeaderboardEntry {
  participant_id: string;
  display_name: string | null;
  city: string | null;
  role: string | null;
  total_xp: number;
  debts_paid: number;
  streak: number;
  is_current: boolean;
}

/**
 * En çok XP'ye sahip ilk 10 katılımcıyı çeker. RPC hesap UUID'sini
 * döndürmez; mevcut kullanıcı bilgisi de sunucuda hesaplanır.
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client.rpc('get_leaderboard', { p_limit: 10 });

  if (error) {
    console.warn('[leaderboard] fetch hatası:', error.message);
    return [];
  }
  return (data || []) as LeaderboardEntry[];
}

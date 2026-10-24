import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeStreak } from './streak';

// Ağ sınırı: hesap verisini okuyan sorgu zincirini taklit eden sahte istemci.
const { tables, fakeClient } = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {
    device_snapshots: [],
    survey_submissions: [],
    merchant_debts: [],
  };
  const query = (table: string) => {
    const result = () => ({ data: tables[table], error: null });
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: async () => result(),
      maybeSingle: async () => ({ data: tables[table][0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return q;
  };
  return { tables, fakeClient: { from: query } };
});

vi.mock('./supabase', () => ({ getSupabase: () => fakeClient }));

import { fetchAccountData } from './auth';

describe('fetchAccountData', () => {
  beforeEach(() => {
    tables.device_snapshots = [{ total_xp: 120, debts_paid: 3, total_donated: 900, streak: 2 }];
    // 2026-10-23T22:30Z = 24 Ekim 01:30 (UTC+3)
    tables.survey_submissions = [
      {
        id: 's1',
        debt_id: 'd1',
        created_at: '2026-10-23T22:30:00Z',
        debt_category: 'gida',
        debt_title: 'Ekmek borcu',
        debt_amount: 180,
        debt_urgency: 3,
        pre_emotion: 'merak',
        post_emotion: 'mutlu',
        will_repeat: 'evet',
        xp_gained: 20,
      },
    ];
  });

  it('son iyiliğin gününü UTC değil yerel takvime göre verir', async () => {
    const data = await fetchAccountData('u1');

    expect(data.lastActionDate).toBe('2026-10-24');
  });

  it('aynı gün yeniden girişten sonraki ikinci iyilik seriyi artırmaz', async () => {
    const data = await fetchAccountData('u1');

    const next = computeStreak(data.lastActionDate, data.streak, new Date('2026-10-24T09:00:00Z'));

    expect(next.streak).toBe(2);
  });
});

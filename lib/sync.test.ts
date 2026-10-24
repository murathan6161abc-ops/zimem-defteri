import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Debt, HistoryEntry, PostTestData, PreTestData } from '@/types';

// Ağ sınırı: Supabase istemcisi yerine ödeme RPC'sini ve tablo yazımını taklit eden sahte istemci.
const { inserts, fakeClient } = vi.hoisted(() => {
  const inserts: Record<string, unknown>[] = [];
  const fakeClient = {
    rpc: async () => ({
      data: [{ id: 'debt-1', paid_amount: 480, new_amount: 0, closed: true, closed_at: '2026-10-24T09:00:00Z' }],
      error: null,
    }),
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: null };
      },
    }),
  };
  return { inserts, fakeClient };
});

vi.mock('./supabase', () => ({ getSupabase: () => fakeClient }));

import { syncSurveySubmission } from './sync';

const debt: Debt = {
  id: 'debt-1',
  category: 'gida',
  title: 'Ekmek borcu',
  description: 'Temel gıda',
  amount: 480,
  urgency: 3,
  icon: '🍞',
};
const pre: PreTestData = { huzur: 5, emotion: 'merak', emotionValue: 2, likert: 4 };
const post: PostTestData = { huzur: 8, emotion: 'mutlu', emotionValue: 4, likert: 5, willRepeat: 'evet' };
const entry: HistoryEntry = {
  id: 'h1',
  debtId: 'debt-1',
  date: '2026-10-24T09:00:00Z',
  category: 'gida',
  title: 'Ekmek borcu',
  amount: 480,
  xp: 27,
  preEmotion: 'merak',
  postEmotion: 'mutlu',
  willRepeat: 'evet',
  urgency: 3,
};

describe('syncSurveySubmission', () => {
  beforeEach(() => {
    inserts.length = 0;
  });

  it('PANAS bölümü atlanınca toplamları 0 değil boş (null) yazar', async () => {
    await syncSurveySubmission({ debt, pre, post, entry, profile: null, payAmount: 480 });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      panas_neg_scores: null,
      panas_neg_total: null,
      panas_pos_scores: null,
      panas_pos_total: null,
    });
  });

  it('PANAS doldurulunca madde puanlarını ve toplamı yazar', async () => {
    const panasNeg = { tense: 1, angry: 2, afraid: 1, guilty: 1, upset: 2 };
    const panasPos = { excited: 4, interested: 5, attentive: 3, determined: 4, active: 4 };

    await syncSurveySubmission({
      debt,
      pre: { ...pre, panasNeg },
      post: { ...post, panasPos },
      entry,
      profile: null,
      payAmount: 480,
    });

    expect(inserts[0]).toMatchObject({
      panas_neg_scores: panasNeg,
      panas_neg_total: 7,
      panas_pos_scores: panasPos,
      panas_pos_total: 20,
    });
  });
});

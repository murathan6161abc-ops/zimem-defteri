import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Debt, HistoryEntry, PostTestData, PreTestData } from '@/types';

// Ağ sınırı: Supabase istemcisi yerine tablo yazımını yakalayan sahte istemci.
const { inserts, fakeClient, db } = vi.hoisted(() => {
  const inserts: Record<string, unknown>[] = [];
  // newColumns=false: PANAS ön-son göçü çalıştırılmamış veritabanı gibi davranır.
  const db = { newColumns: true };
  const fakeClient = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        if (!db.newColumns && 'pre_panas_pos_scores' in row) {
          return {
            error: {
              code: 'PGRST204',
              message: "Could not find the 'post_panas_neg_scores' column of 'survey_submissions' in the schema cache",
            },
          };
        }
        inserts.push(row);
        return { error: null };
      },
    }),
  };
  return { inserts, fakeClient, db };
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
    db.newColumns = true;
  });

  it('PANAS bölümü atlanınca toplamları 0 değil boş (null) yazar', async () => {
    await syncSurveySubmission({ debt, pre, post, entry, profile: null });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      panas_neg_scores: null,
      panas_neg_total: null,
      panas_pos_scores: null,
      panas_pos_total: null,
      pre_panas_pos_scores: null,
      pre_panas_pos_total: null,
      post_panas_neg_scores: null,
      post_panas_neg_total: null,
    });
  });

  it('iki alt ölçeği hem ön hem son test için yazar', async () => {
    const preNeg = { tense: 3, angry: 2, afraid: 2, guilty: 1, upset: 3 };
    const prePos = { excited: 2, interested: 3, attentive: 3, determined: 2, active: 2 };
    const postNeg = { tense: 1, angry: 1, afraid: 1, guilty: 1, upset: 1 };
    const postPos = { excited: 4, interested: 5, attentive: 4, determined: 4, active: 4 };

    await syncSurveySubmission({
      debt,
      pre: { ...pre, panasNeg: preNeg, panasPos: prePos },
      post: { ...post, panasNeg: postNeg, panasPos: postPos },
      entry,
      profile: null,
    });

    expect(inserts[0]).toMatchObject({
      panas_neg_total: 11,
      pre_panas_pos_scores: prePos,
      pre_panas_pos_total: 12,
      panas_pos_total: 21,
      post_panas_neg_scores: postNeg,
      post_panas_neg_total: 5,
    });
  });

  it('göç çalıştırılmamışsa gönderimi yeni PANAS sütunları olmadan yine kaydeder', async () => {
    db.newColumns = false;
    const panasNeg = { tense: 1, angry: 2, afraid: 1, guilty: 1, upset: 2 };
    const panasPos = { excited: 4, interested: 5, attentive: 3, determined: 4, active: 4 };

    await syncSurveySubmission({
      debt,
      pre: { ...pre, panasNeg, panasPos },
      post: { ...post, panasNeg, panasPos },
      entry,
      profile: null,
    });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ pre_huzur: 5, post_huzur: 8, panas_neg_total: 7, panas_pos_total: 20 });
    expect(inserts[0]).not.toHaveProperty('pre_panas_pos_scores');
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
    });

    expect(inserts[0]).toMatchObject({
      panas_neg_scores: panasNeg,
      panas_neg_total: 7,
      panas_pos_scores: panasPos,
      panas_pos_total: 20,
    });
  });

  it('borç tutarı yerine sunucunun düştüğü katkı tutarını yazar', async () => {
    await syncSurveySubmission({ debt, pre, post, entry: { ...entry, amount: 120 }, profile: null });

    expect(inserts[0]).toMatchObject({ debt_id: 'debt-1', debt_amount: 120 });
  });
});

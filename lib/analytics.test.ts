import { describe, expect, it } from 'vitest';
import { aggregateHuzurStats, type SurveyResult } from './analytics';

function row(pre: number | null, post: number | null, emotion = 'mutlu'): SurveyResult {
  return {
    id: `${pre}-${post}-${emotion}`,
    created_at: '2026-10-24T09:00:00Z',
    pre_huzur: pre,
    pre_emotion: 'merak',
    pre_likert: 4,
    post_huzur: post,
    post_emotion: emotion,
    post_likert: 5,
    will_repeat: 'evet',
    xp_gained: 20,
    debt_title: 'Ekmek borcu',
    debt_category: 'gida',
  };
}

describe('aggregateHuzurStats', () => {
  it('huzur ortalamasını yalnızca iki puanı da ölçülmüş kayıtlardan hesaplar', () => {
    const stats = aggregateHuzurStats([row(4, 8), row(6, 7), row(5, null, 'dingin')]);

    expect(stats.count).toBe(2);
    expect(stats.avgPre).toBe(5);
    expect(stats.avgPost).toBe(7.5);
    expect(stats.change).toBe(2.5);
  });

  it('eşleşmiş kayıt yoksa huzur için tahmin üretmez, duyguları yine sayar', () => {
    const stats = aggregateHuzurStats([row(5, null, 'dingin'), row(null, null)]);

    expect(stats.count).toBe(0);
    expect(stats.avgPost).toBe(0);
    expect(stats.emotionCounts).toEqual({ dingin: 1, mutlu: 1 });
  });
});

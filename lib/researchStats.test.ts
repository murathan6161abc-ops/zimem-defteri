import { describe, expect, it } from 'vitest';
import { PANAS_NEG, PANAS_POS, anonymizedCsv, buildStatsMarkdown, participantPairs, type ResearchRow } from './researchStats';

function row(user: string, pre: number | null, post: number | null, extra: Partial<ResearchRow> = {}): ResearchRow {
  return {
    user_id: user,
    created_at: '2026-10-20T10:00:00Z',
    debt_category: 'gida',
    debt_amount: 100,
    debt_urgency: 2,
    pre_huzur: pre,
    post_huzur: post,
    pre_emotion: 'merak',
    post_emotion: 'mutlu',
    pre_emotion_value: 1,
    post_emotion_value: 1,
    pre_likert: 4,
    post_likert: 5,
    will_repeat: 'evet',
    panas_neg_total: null,
    panas_pos_total: null,
    age_group: 'minor',
    app_version: '2.8.0',
    ...extra,
  };
}

describe('participantPairs', () => {
  it('aynı kişinin gönderimlerini ortalamaya indirir, eksik ölçümü atlar', () => {
    const pairs = participantPairs([row('a', 4, 6), row('a', 6, 8), row('b', 5, 5), row('c', null, 7)]);
    expect(pairs).toHaveLength(2);
    expect(pairs).toContainEqual({ before: 5, after: 7 });
    expect(pairs).toContainEqual({ before: 5, after: 5 });
  });
});

describe('buildStatsMarkdown', () => {
  it('katılımcı düzeyinde t testi ve yöntem notlarını yazar', () => {
    const md = buildStatsMarkdown([row('a', 4, 6), row('b', 5, 6), row('c', 3, 6), row('d', 6, 6)]);
    expect(md).toContain('Katılımcı düzeyi (n = 4)');
    expect(md).toContain('Eşleştirilmiş t testi: t(3)');
    expect(md).toContain('aynı maddelerle');
  });

  it('PANAS için ön-son eşleştirilmiş test yazar', () => {
    const md = buildStatsMarkdown([
      row('a', 4, 6, { pre_panas_pos_total: 12, panas_pos_total: 18, panas_neg_total: 10, post_panas_neg_total: 7 }),
      row('b', 5, 6, { pre_panas_pos_total: 14, panas_pos_total: 17, panas_neg_total: 9, post_panas_neg_total: 8 }),
      row('c', 3, 6, { pre_panas_pos_total: 11, panas_pos_total: 19, panas_neg_total: 12, post_panas_neg_total: 6 }),
    ]);
    expect(md).toContain('Pozitif duygu (n = 3)');
    expect(md).toContain('Negatif duygu (n = 3)');
  });
});

describe('PANAS çiftleri', () => {
  it('yalnızca iki ölçümü de olan gönderimlerden çift kurar (eski sürüm satırları girmez)', () => {
    const rows = [
      row('a', 4, 6, { pre_panas_pos_total: 10, panas_pos_total: 16 }),
      row('a', 4, 6, { pre_panas_pos_total: 12, panas_pos_total: 18 }),
      // 2.8.0 satırı: ön test pozitif yok
      row('b', 4, 6, { panas_pos_total: 20, panas_neg_total: 9 }),
    ];
    expect(participantPairs(rows, PANAS_POS)).toEqual([{ before: 11, after: 17 }]);
    expect(participantPairs(rows, PANAS_NEG)).toEqual([]);
  });
});

describe('anonymizedCsv', () => {
  it('kimlik ve serbest metin sütunlarını dışa aktarmaz, katılımcıları kodlar', () => {
    const csv = anonymizedCsv([
      row('uuid-2', 4, 6, { created_at: '2026-10-21T09:00:00Z' }),
      row('uuid-1', 5, 7, { created_at: '2026-10-20T09:00:00Z', panas_neg_scores: { tense: 2, angry: 1, afraid: 1, guilty: 1, upset: 2 } }),
    ]);
    const [header, first, second] = csv.split('\n');
    expect(header.startsWith('katilimci,yas_grubu,tarih')).toBe(true);
    expect(csv).not.toContain('uuid-');
    expect(first.startsWith('K001,minor,2026-10-20')).toBe(true);
    expect(second.startsWith('K002,minor,2026-10-21')).toBe(true);
    expect(first).toContain(',2,1,1,1,2,');
    expect(header).toContain('on_panas_pozitif_toplam');
    expect(header).toContain('son_panas_negatif_toplam');
  });
});

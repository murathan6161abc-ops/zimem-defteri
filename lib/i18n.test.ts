import { describe, expect, it } from 'vitest';
import { interpolate } from './i18n';
import en from './locales/en';

describe('interpolate', () => {
  it('yer tutucuları doldurur, bilinmeyeni olduğu gibi bırakır', () => {
    expect(interpolate('{days} gün sonra', { days: 3 })).toBe('3 gün sonra');
    expect(interpolate('{a} {b}', { a: 1 })).toBe('1 {b}');
    expect(interpolate('{n} gün')).toBe('{n} gün');
  });

  it('İngilizcede 1 için tekil, diğerleri için çoğul seçer', () => {
    expect(interpolate(en.score.streak_days, { n: 1 })).toBe('1 day');
    expect(interpolate(en.score.streak_days, { n: 0 })).toBe('0 days');
    expect(interpolate(en.score.streak_days, { n: 7 })).toBe('7 days');
    expect(interpolate(en.common.star_rating, { n: 1 })).toBe('1 star');
    expect(interpolate(en.who5.locked, { days: 1 })).toBe('Next test unlocks in 1 day');
  });
});

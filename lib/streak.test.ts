import { describe, expect, it } from 'vitest';
import { computeStreak, dayKey } from './streak';

describe('dayKey', () => {
  it('Türkiye saatiyle gece yarısından sonrasını yeni gün sayar', () => {
    // 2026-10-23T22:30Z = 24 Ekim 01:30 (UTC+3)
    expect(dayKey(new Date('2026-10-23T22:30:00Z'))).toBe('2026-10-24');
  });
});

describe('computeStreak', () => {
  const today = new Date('2026-10-24T09:00:00Z'); // 24 Ekim 12:00

  it('ilk iyilikte seriyi 1 ile başlatır', () => {
    expect(computeStreak(null, 0, today)).toEqual({ streak: 1, dateKey: '2026-10-24' });
  });

  it('aynı günün ikinci iyiliği seriyi artırmaz', () => {
    expect(computeStreak('2026-10-24', 3, today)).toEqual({ streak: 3, dateKey: '2026-10-24' });
  });

  it('dünkü iyiliğin ardından seriyi bir artırır', () => {
    expect(computeStreak('2026-10-23', 3, today)).toEqual({ streak: 4, dateKey: '2026-10-24' });
  });

  it('bir gün atlanınca seriyi 1e döndürür', () => {
    expect(computeStreak('2026-10-22', 3, today)).toEqual({ streak: 1, dateKey: '2026-10-24' });
  });
});

import { describe, expect, it } from 'vitest';
import { consentComplete, isAgeGroup } from './research';

describe('consentComplete', () => {
  it('yaş grubu seçilmeden kayıt tamamlanmaz', () => {
    expect(consentComplete(null, false)).toBe(false);
    expect(consentComplete(null, true)).toBe(false);
  });

  it('18 yaş üstü için veli onamı istenmez', () => {
    expect(consentComplete('adult', false)).toBe(true);
  });

  it('18 yaş altı için veli onamı beyanı şarttır', () => {
    expect(consentComplete('minor', false)).toBe(false);
    expect(consentComplete('minor', true)).toBe(true);
  });
});

describe('isAgeGroup', () => {
  it('yalnızca bilinen değerleri kabul eder', () => {
    expect(isAgeGroup('minor')).toBe(true);
    expect(isAgeGroup('adult')).toBe(true);
    expect(isAgeGroup('teen')).toBe(false);
    expect(isAgeGroup(undefined)).toBe(false);
  });
});

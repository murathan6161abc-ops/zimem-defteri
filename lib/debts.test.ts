import { describe, expect, it } from 'vitest';
import { parsePartialAmount } from './debts';

describe('parsePartialAmount', () => {
  it('1 ile kalan tutar arasındaki tam sayıyı kabul eder', () => {
    expect(parsePartialAmount('50', 480)).toBe(50);
    expect(parsePartialAmount('480', 480)).toBe(480);
    expect(parsePartialAmount(' 75 ', 480)).toBe(75);
  });

  it('kalan tutarı aşan, sıfır ya da boş girişi reddeder', () => {
    expect(parsePartialAmount('481', 480)).toBeNull();
    expect(parsePartialAmount('0', 480)).toBeNull();
    expect(parsePartialAmount('', 480)).toBeNull();
  });

  it('küsuratlı tutarı reddeder', () => {
    expect(parsePartialAmount('0.4', 480)).toBeNull();
    expect(parsePartialAmount('12.5', 480)).toBeNull();
    expect(parsePartialAmount('12,5', 480)).toBeNull();
  });

  it('sayı dışı karakter içeren girişi reddeder', () => {
    expect(parsePartialAmount('50abc', 480)).toBeNull();
    expect(parsePartialAmount('1e2', 480)).toBeNull();
    expect(parsePartialAmount('-5', 480)).toBeNull();
  });
});

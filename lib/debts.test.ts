import { describe, expect, it } from 'vitest';
import { formatTL, parsePartialAmount, parseWholeAmount } from './debts';

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

describe('parseWholeAmount', () => {
  it('binlik noktalı ve düz tam sayıyı okur', () => {
    expect(parseWholeAmount('1250')).toBe(1250);
    expect(parseWholeAmount('1.250')).toBe(1250);
    expect(parseWholeAmount('12.500.000')).toBe(12500000);
    expect(parseWholeAmount(' 180 ')).toBe(180);
  });

  it('küsuratlı ya da bozuk girişi yuvarlamadan reddeder', () => {
    expect(parseWholeAmount('12,50')).toBeNaN();
    expect(parseWholeAmount('12.5')).toBeNaN();
    expect(parseWholeAmount('1.25')).toBeNaN();
    expect(parseWholeAmount('')).toBeNaN();
    expect(parseWholeAmount('abc')).toBeNaN();
  });
});

describe('formatTL', () => {
  it('Türkçede binlik ayırıcı olarak nokta kullanır', () => {
    expect(formatTL(1250)).toBe('1.250 ₺');
    expect(formatTL(90)).toBe('90 ₺');
  });
});

import { describe, expect, it } from 'vitest';
import { SAMPLE_DEBTS, demoOpenDebts, formatTL, parsePartialAmount, parseWholeAmount } from './debts';

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

describe('demoOpenDebts', () => {
  const [first, second, third] = SAMPLE_DEBTS;

  it('hiç ödeme yoksa örnek borçların hepsi açıktır', () => {
    expect(demoOpenDebts(SAMPLE_DEBTS, [], {})).toEqual(SAMPLE_DEBTS);
  });

  it('bu cihazda tamamen kapatılan borç listeye geri dönmez', () => {
    const open = demoOpenDebts(SAMPLE_DEBTS, [{ debtId: first.id }], {});
    expect(open.map((d) => d.id)).not.toContain(first.id);
    expect(open).toHaveLength(SAMPLE_DEBTS.length - 1);
  });

  it('kısmen ödenen borç kalan tutarla görünür', () => {
    const open = demoOpenDebts(SAMPLE_DEBTS, [{ debtId: second.id }], { [second.id]: 100 });
    expect(open.find((d) => d.id === second.id)?.amount).toBe(second.amount - 100);
    expect(open).toHaveLength(SAMPLE_DEBTS.length);
  });

  it('örnek listeyi değiştirmez', () => {
    const before = third.amount;
    demoOpenDebts(SAMPLE_DEBTS, [{ debtId: third.id }], { [third.id]: 10 });
    expect(third.amount).toBe(before);
  });
});

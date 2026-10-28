import { describe, expect, it } from 'vitest';
import {
  cronbachAlpha,
  formatP,
  normalCdf,
  pairedTTest,
  tCritical,
  tTwoTailedP,
  wilcoxonSignedRank,
} from './stats';

describe('dağılımlar', () => {
  it('standart normal tablo değerleriyle uyuşur', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normalCdf(-1.644854)).toBeCloseTo(0.05, 5);
  });

  it('t tablosundaki kritik değerleri verir', () => {
    expect(tCritical(4)).toBeCloseTo(2.776445, 4);
    expect(tCritical(9)).toBeCloseTo(2.262157, 4);
    expect(tCritical(30)).toBeCloseTo(2.042272, 4);
    expect(tTwoTailedP(2.776445, 4)).toBeCloseTo(0.05, 5);
    expect(tTwoTailedP(0, 10)).toBeCloseTo(1, 6);
  });
});

describe('pairedTTest', () => {
  it('elle hesaplanan örnekle aynı sonucu verir', () => {
    // farklar: 1, 1, 2, 0, 2 → ort 1.2, SS 0.8367, t(4) = 3.207
    const r = pairedTTest([1, 2, 3, 4, 5], [2, 3, 5, 4, 7])!;
    expect(r.n).toBe(5);
    expect(r.meanDiff).toBeCloseTo(1.2, 6);
    expect(r.sdDiff).toBeCloseTo(0.83666, 4);
    expect(r.t).toBeCloseTo(3.2071, 3);
    expect(r.df).toBe(4);
    expect(r.p).toBeGreaterThan(0.03);
    expect(r.p).toBeLessThan(0.035);
    expect(r.cohenDz).toBeCloseTo(1.4343, 3);
    // %95 GA: 1.2 ± 2.7764 × 0.37417
    expect(r.ci95[0]).toBeCloseTo(0.1612, 3);
    expect(r.ci95[1]).toBeCloseTo(2.2388, 3);
  });

  it('değişkenlik yoksa ya da çift azsa sonuç vermez', () => {
    expect(pairedTTest([1, 2, 3], [2, 3, 4])).toBeNull();
    expect(pairedTTest([1], [2])).toBeNull();
  });
});

describe('wilcoxonSignedRank', () => {
  it('tüm farklar pozitifken normal yaklaşımı hesaplar', () => {
    // W+ = 15, beklenen 7.5, varyans 13.75 → z = (7.5 − 0.5) / 3.708 = 1.888
    const r = wilcoxonSignedRank([0, 0, 0, 0, 0], [1, 2, 3, 4, 5])!;
    expect(r.n).toBe(5);
    expect(r.wPlus).toBe(15);
    expect(r.z).toBeCloseTo(1.8878, 3);
    expect(r.p).toBeCloseTo(0.059, 2);
  });

  it('sıfır farkları dışarıda bırakır ve bağlara ortalama sıra verir', () => {
    const r = wilcoxonSignedRank([5, 5, 5, 5], [5, 6, 6, 4])!;
    expect(r.n).toBe(3);
    // |fark| = 1, 1, 1 → hepsi sıra 2; pozitifler: 2 tane → W+ = 4
    expect(r.wPlus).toBe(4);
  });
});

describe('cronbachAlpha', () => {
  it('maddeler birlikte artarken 1 verir', () => {
    expect(cronbachAlpha([[1, 2], [2, 3], [3, 4]])!.alpha).toBeCloseTo(1, 6);
  });

  it('formülle elle hesaplanan değeri verir ve eksik satırı atlar', () => {
    // madde varyansları 1 ve 1, toplam varyansı 1 → α = 2 × (1 − 2) = −2
    const r = cronbachAlpha([[1, 3], [2, 1], [3, 2], [Number.NaN, 4]])!;
    expect(r.n).toBe(3);
    expect(r.alpha).toBeCloseTo(-2, 6);
  });
});

describe('formatP', () => {
  it('APA biçiminde yazar', () => {
    expect(formatP(0.0004)).toBe('p < .001');
    expect(formatP(0.0327)).toBe('p = .033');
  });
});

import { describe, expect, it } from 'vitest';
import { parseAmount } from './ledgerParse';

describe('parseAmount', () => {
  it('Türkçe yazımdaki binlik noktayı ve ondalık virgülü çözer', () => {
    expect(parseAmount('1.250')).toBe(1250);
    expect(parseAmount('1.250,50')).toBe(1251);
    expect(parseAmount('12,50')).toBe(13);
    expect(parseAmount('180')).toBe(180);
  });

  it('para birimi yazısını yok sayar', () => {
    expect(parseAmount('85 TL')).toBe(85);
  });

  it('boş girişte 0 döndürür', () => {
    expect(parseAmount('')).toBe(0);
  });
});

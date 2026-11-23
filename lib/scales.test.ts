import { describe, expect, it } from 'vitest';
import { PANAS_DISPLAY_ORDER, PANAS_NEGATIVE, PANAS_POSITIVE, splitPanas } from './scales';

const all = (v: number) => Object.fromEntries(PANAS_DISPLAY_ORDER.map((i) => [i.key, v]));

describe('PANAS_DISPLAY_ORDER', () => {
  it('iki alt ölçeğin 10 maddesini birer kez içerir', () => {
    const keys = PANAS_DISPLAY_ORDER.map((i) => i.key).sort();
    expect(keys).toEqual([...PANAS_NEGATIVE, ...PANAS_POSITIVE].map((i) => i.key).sort());
  });
});

describe('splitPanas', () => {
  it('10 cevabı negatif ve pozitif alt ölçeklere ayırır', () => {
    const r = splitPanas({ ...all(2), excited: 5 })!;
    expect(Object.keys(r.panasNeg).sort()).toEqual(PANAS_NEGATIVE.map((i) => i.key).sort());
    expect(Object.keys(r.panasPos).sort()).toEqual(PANAS_POSITIVE.map((i) => i.key).sort());
    expect(r.panasPos.excited).toBe(5);
  });

  it('eksik ya da geçersiz cevapta null döner (bölüm tamamlanmamış)', () => {
    const missing = all(3);
    delete missing.upset;
    expect(splitPanas(missing)).toBeNull();
    expect(splitPanas({ ...all(3), tense: 0 })).toBeNull();
    expect(splitPanas({ ...all(3), tense: 6 })).toBeNull();
  });
});

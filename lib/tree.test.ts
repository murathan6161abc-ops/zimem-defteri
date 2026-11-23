import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@/types';
import { LEAF_ANCHORS, buildTree } from './tree';

function entries(n: number): HistoryEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `d${i}-${1700000000000 + i}`,
    debtId: `d${i}`,
    date: new Date(1700000000000 + i).toISOString(),
    category: 'gida',
    title: 'Borç',
    amount: 100,
    xp: 20,
    preEmotion: 'merak',
    postEmotion: 'mutlu',
    willRepeat: 'evet',
    urgency: 2,
  }));
}

// Yaprak, yerinden en fazla ±14 birim kayar (jitter 28).
function nearAnchorOfTier(x: number, y: number, maxTierXp: number): boolean {
  return LEAF_ANCHORS.some((a) => a.xp <= maxTierXp && Math.abs(a.at[0] - x) <= 14 && Math.abs(a.at[1] - y) <= 14);
}

describe('buildTree', () => {
  it('0 XP\'de gövde ve ilk iki dal vardır (sayfadaki "0–149 XP: gövde ve ilk dallar")', () => {
    expect(buildTree([], 0).branches).toHaveLength(3);
  });

  it('150 ve 350 XP\'de yeni dallar çıkar', () => {
    expect(buildTree([], 150).branches).toHaveLength(6);
    expect(buildTree([], 350).branches).toHaveLength(10);
  });

  it('dalları henüz büyümemiş yerlere yaprak koymaz', () => {
    const low = buildTree(entries(12), 120);
    expect(low.leaves).toHaveLength(12);
    for (const leaf of low.leaves) expect(nearAnchorOfTier(leaf.x, leaf.y, 0)).toBe(true);

    const mid = buildTree(entries(20), 200);
    for (const leaf of mid.leaves) expect(nearAnchorOfTier(leaf.x, leaf.y, 150)).toBe(true);
  });

  it('yüksek XP\'de uç dallardaki yerler de kullanılır', () => {
    const high = buildTree(entries(LEAF_ANCHORS.length), 400);
    const usesTopTier = high.leaves.some(
      (l) => !nearAnchorOfTier(l.x, l.y, 150) && nearAnchorOfTier(l.x, l.y, 350),
    );
    expect(usesTopTier).toBe(true);
  });

  it('aynı geçmiş her seferinde aynı ağacı verir', () => {
    expect(buildTree(entries(5), 80)).toEqual(buildTree(entries(5), 80));
  });
});

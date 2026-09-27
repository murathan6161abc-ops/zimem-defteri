import type { LevelInfo } from '@/types';

// name yerine i18n anahtarı (key) tutulur; ad çeviri sözlüğünden gelir (levels.l0…l5)
export const LEVELS: LevelInfo[] = [
  { index: 0, key: 'l0', minXP: 0, emoji: '🌱' },
  { index: 1, key: 'l1', minXP: 50, emoji: '🚶' },
  { index: 2, key: 'l2', minXP: 150, emoji: '💚' },
  { index: 3, key: 'l3', minXP: 350, emoji: '🏛️' },
  { index: 4, key: 'l4', minXP: 600, emoji: '🌟' },
  { index: 5, key: 'l5', minXP: 1000, emoji: '👑' },
];

export function getLevelInfo(xp: number) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXP) current = lvl;
  }
  const next = LEVELS[current.index + 1];
  const progress = next
    ? Math.min(100, ((xp - current.minXP) / (next.minXP - current.minXP)) * 100)
    : 100;
  const remaining = next ? next.minXP - xp : 0;
  return { current, next, progress, remaining };
}

import type { Achievement, HistoryEntry } from '@/types';

export interface AchievementState {
  xp: number;
  debtsPaid: number;
  streak: number;
  totalDonated: number;
  history: HistoryEntry[];
  unlocked: Set<string>;
}

export interface AchievementDef extends Achievement {
  condition: (s: AchievementState) => boolean;
}

// name/desc yerine i18n anahtarı tutulur; metin sözlükten gelir (ach.*_name / ach.*_desc)
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_deed',
    nameKey: 'ach.first_deed_name',
    descKey: 'ach.first_deed_desc',
    emoji: '🎯',
    condition: (s) => s.debtsPaid >= 1,
  },
  {
    id: 'five_deeds',
    nameKey: 'ach.five_deeds_name',
    descKey: 'ach.five_deeds_desc',
    emoji: '🖐️',
    condition: (s) => s.debtsPaid >= 5,
  },
  {
    id: 'ten_deeds',
    nameKey: 'ach.ten_deeds_name',
    descKey: 'ach.ten_deeds_desc',
    emoji: '🔟',
    condition: (s) => s.debtsPaid >= 10,
  },
  {
    id: 'big_heart',
    nameKey: 'ach.big_heart_name',
    descKey: 'ach.big_heart_desc',
    emoji: '❤️',
    condition: (s) => s.totalDonated >= 1000,
  },
  {
    id: 'streak_3',
    nameKey: 'ach.streak_3_name',
    descKey: 'ach.streak_3_desc',
    emoji: '🔥',
    condition: (s) => s.streak >= 3,
  },
  {
    id: 'streak_7',
    nameKey: 'ach.streak_7_name',
    descKey: 'ach.streak_7_desc',
    emoji: '🌈',
    condition: (s) => s.streak >= 7,
  },
  {
    id: 'level_up',
    nameKey: 'ach.level_up_name',
    descKey: 'ach.level_up_desc',
    emoji: '💚',
    condition: (s) => s.xp >= 150,
  },
  {
    id: 'vakif',
    nameKey: 'ach.vakif_name',
    descKey: 'ach.vakif_desc',
    emoji: '🏛️',
    condition: (s) => s.xp >= 350,
  },
  {
    id: 'master',
    nameKey: 'ach.master_name',
    descKey: 'ach.master_desc',
    emoji: '👑',
    condition: (s) => s.xp >= 1000,
  },
  {
    id: 'high_xp_single',
    nameKey: 'ach.high_xp_single_name',
    descKey: 'ach.high_xp_single_desc',
    emoji: '⚡',
    condition: (s) => s.history.some((h) => h.xp >= 50),
  },
  {
    id: 'all_categories',
    nameKey: 'ach.all_categories_name',
    descKey: 'ach.all_categories_desc',
    emoji: '🎨',
    condition: (s) => new Set(s.history.map((h) => h.category)).size >= 4,
  },
  {
    id: 'tree_bloomed',
    nameKey: 'ach.tree_bloomed_name',
    descKey: 'ach.tree_bloomed_desc',
    emoji: '🌸',
    condition: (s) => s.history.length >= 10,
  },
];

/** Returns newly unlocked achievement IDs after a state change. */
export function checkUnlocks(state: AchievementState): AchievementDef[] {
  return ACHIEVEMENTS.filter(
    (a) => !state.unlocked.has(a.id) && a.condition(state),
  );
}

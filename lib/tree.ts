import type { HistoryEntry, Category } from '@/types';
import { CATEGORY_META } from './debts';

// Deterministic pseudo-random from a seed (xorshift32)
function seeded(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export interface Leaf {
  id: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
  category: Category;
  bloom: boolean; // çiçek mi yaprak mı
}

export interface TreeLayout {
  leaves: Leaf[];
  branches: Branch[];
  glow: boolean; // 1000 XP üstü
  fruit: boolean; // 600 XP üstü
}

export interface Branch {
  d: string; // SVG path
  width: number;
}

const TRUNK_X = 200;
const TRUNK_BOTTOM_Y = 380;
const TRUNK_TOP_Y = 220;

// Branches grow at XP thresholds. Two anchor points (left/right) per tier.
const BRANCH_TIERS: { xp: number; branches: { from: [number, number]; to: [number, number]; width: number }[] }[] = [
  {
    xp: 0,
    branches: [
      { from: [TRUNK_X, TRUNK_BOTTOM_Y], to: [TRUNK_X, TRUNK_TOP_Y], width: 14 },
    ],
  },
  {
    xp: 50,
    branches: [
      { from: [TRUNK_X, 300], to: [120, 240], width: 8 },
      { from: [TRUNK_X, 300], to: [280, 240], width: 8 },
    ],
  },
  {
    xp: 150,
    branches: [
      { from: [TRUNK_X, 260], to: [90, 180], width: 6 },
      { from: [TRUNK_X, 260], to: [310, 180], width: 6 },
      { from: [TRUNK_X, TRUNK_TOP_Y], to: [TRUNK_X, 160], width: 8 },
    ],
  },
  {
    xp: 350,
    branches: [
      { from: [120, 240], to: [60, 200], width: 4 },
      { from: [280, 240], to: [340, 200], width: 4 },
      { from: [90, 180], to: [50, 150], width: 4 },
      { from: [310, 180], to: [350, 150], width: 4 },
    ],
  },
];

function pathCurve(from: [number, number], to: [number, number]): string {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const cx = (x1 + x2) / 2 + (x2 - x1) * 0.1;
  const cy = (y1 + y2) / 2 - 20;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

// Place leaves around branch endpoints. As history grows, leaves multiply.
// Each leaf maps to one HistoryEntry index (deterministic position).
const LEAF_ANCHORS: [number, number][] = [
  [120, 240], [280, 240], [200, 160], // tier 1+2
  [90, 180], [310, 180], [200, 220], [200, 200],
  [60, 200], [340, 200], [50, 150], [350, 150], // tier 3
  [140, 220], [260, 220], [110, 200], [290, 200],
  [80, 170], [320, 170], [180, 140], [220, 140],
  [70, 220], [330, 220], [160, 180], [240, 180],
  [100, 240], [300, 240], [150, 160], [250, 160],
];

export function buildTree(history: HistoryEntry[], xp: number): TreeLayout {
  // Branches up to current XP threshold
  const branches: Branch[] = [];
  for (const tier of BRANCH_TIERS) {
    if (xp >= tier.xp) {
      for (const b of tier.branches) {
        branches.push({ d: pathCurve(b.from, b.to), width: b.width });
      }
    }
  }

  const leaves: Leaf[] = history.map((h, i) => {
    const rng = seeded(hashStr(h.id) + i * 17);
    const anchor = LEAF_ANCHORS[i % LEAF_ANCHORS.length];
    const jitterX = (rng() - 0.5) * 28;
    const jitterY = (rng() - 0.5) * 28;
    const bloom = xp >= 350 && rng() > 0.5;
    return {
      id: h.id,
      x: anchor[0] + jitterX,
      y: anchor[1] + jitterY,
      size: bloom ? 14 + rng() * 5 : 12 + rng() * 4,
      rotation: rng() * 360,
      color: CATEGORY_META[h.category].color,
      category: h.category,
      bloom,
    };
  });

  return {
    leaves,
    branches,
    glow: xp >= 1000,
    fruit: xp >= 600,
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

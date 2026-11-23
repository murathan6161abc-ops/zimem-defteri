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
// Ağaç sayfasındaki açıklamayla aynı: 0–149 XP gövde ve ilk dallar, 150 XP'de yeni
// dallar, 350 XP'de uç dallar.
const BRANCH_TIERS: { xp: number; branches: { from: [number, number]; to: [number, number]; width: number }[] }[] = [
  {
    xp: 0,
    branches: [
      { from: [TRUNK_X, TRUNK_BOTTOM_Y], to: [TRUNK_X, TRUNK_TOP_Y], width: 14 },
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
// Each leaf maps to one HistoryEntry index (deterministic position). Her yer, onu
// taşıyan dalın çıktığı XP eşiğini bilir; dal henüz büyümediyse o yer kullanılmaz,
// böylece yaprak boşlukta asılı kalmaz.
export const LEAF_ANCHORS: { at: [number, number]; xp: number }[] = [
  { at: [120, 240], xp: 0 }, { at: [280, 240], xp: 0 }, { at: [200, 160], xp: 150 },
  { at: [90, 180], xp: 150 }, { at: [310, 180], xp: 150 }, { at: [200, 220], xp: 0 }, { at: [200, 200], xp: 0 },
  { at: [60, 200], xp: 350 }, { at: [340, 200], xp: 350 }, { at: [50, 150], xp: 350 }, { at: [350, 150], xp: 350 },
  { at: [140, 220], xp: 0 }, { at: [260, 220], xp: 0 }, { at: [110, 200], xp: 150 }, { at: [290, 200], xp: 150 },
  { at: [80, 170], xp: 150 }, { at: [320, 170], xp: 150 }, { at: [180, 140], xp: 150 }, { at: [220, 140], xp: 150 },
  { at: [70, 220], xp: 350 }, { at: [330, 220], xp: 350 }, { at: [160, 180], xp: 150 }, { at: [240, 180], xp: 150 },
  { at: [100, 240], xp: 0 }, { at: [300, 240], xp: 0 }, { at: [150, 160], xp: 150 }, { at: [250, 160], xp: 150 },
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

  const anchors = LEAF_ANCHORS.filter((a) => xp >= a.xp).map((a) => a.at);
  const leaves: Leaf[] = history.map((h, i) => {
    const rng = seeded(hashStr(h.id) + i * 17);
    const anchor = anchors[i % anchors.length];
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

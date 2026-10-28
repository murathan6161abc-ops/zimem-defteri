import type { Debt, Category, DebtKind } from '@/types';
import { KIND_GROUP, LEDGER_KINDS } from './ledgerParse';

// ─── Borç türleri ────────────────────────────────────────────
// Esnaf ayrıntılı türü seçer (bebek, temizlik, yakacak…); veritabanındaki `category`
// ise araştırma analizleri için 4 sabit gruptan biri olarak kalır (group).
// İkonlar yalnızca Emoji 11.0 ve öncesinden seçildi: eski Android'lerde de görünür.
export const DEBT_KINDS: DebtKind[] = LEDGER_KINDS;

export const KIND_META: Record<DebtKind, { group: Category; color: string; emoji: string; icons: string[] }> = {
  gida: {
    group: KIND_GROUP.gida,
    color: '#10b981',
    emoji: '🍞',
    icons: ['🍞', '🥖', '🥛', '🧀', '🥚', '🍅', '🥔', '🥕', '🍎', '🍌', '🍋', '🥬', '🍚', '🍝', '🍗', '🥩', '🐟', '🍯', '☕', '🍵', '🧂', '🥫', '🍪', '🍫'],
  },
  bebek: {
    group: KIND_GROUP.bebek,
    color: '#a78bfa',
    emoji: '🍼',
    icons: ['🍼', '👶', '🧸', '🚼', '🧷', '🥣', '🧦', '🎈'],
  },
  temizlik: {
    group: KIND_GROUP.temizlik,
    color: '#22d3ee',
    emoji: '🧼',
    icons: ['🧼', '🧽', '🧴', '🧻', '🧹', '🧺', '🚿', '🛁', '✨'],
  },
  saglik: {
    group: KIND_GROUP.saglik,
    color: '#ec4899',
    emoji: '💊',
    icons: ['💊', '💉', '🌡️', '😷', '👓', '🦷', '🧪', '🏥', '⚕️'],
  },
  egitim: {
    group: KIND_GROUP.egitim,
    color: '#3b82f6',
    emoji: '📚',
    icons: ['📚', '📓', '📒', '📖', '✏️', '🖍️', '🖊️', '📐', '📏', '🎒', '🧮', '🎨', '🖨️'],
  },
  giyim: {
    group: KIND_GROUP.giyim,
    color: '#f97316',
    emoji: '👕',
    icons: ['👕', '👚', '👖', '🧥', '👗', '👟', '👞', '🥾', '👢', '🧣', '🧤', '🧦', '🎽'],
  },
  yakacak: {
    group: KIND_GROUP.yakacak,
    color: '#ef4444',
    emoji: '🔥',
    icons: ['🔥', '🛢️', '⛽', '♨️', '🕯️', '❄️', '🌡️'],
  },
  fatura: {
    group: KIND_GROUP.fatura,
    color: '#f59e0b',
    emoji: '💡',
    icons: ['💡', '💧', '🔌', '📱', '📶', '🌐', '📺', '☎️', '🧾', '📬'],
  },
  ulasim: {
    group: KIND_GROUP.ulasim,
    color: '#14b8a6',
    emoji: '🚌',
    icons: ['🚌', '🚍', '🚇', '🚕', '🚐', '🚲', '🛵', '🎫', '⛽'],
  },
  diger: {
    group: KIND_GROUP.diger,
    color: '#94a3b8',
    emoji: '📦',
    icons: ['📦', '🛒', '🎁', '🔧', '🔨', '🧰', '🛏️', '🏠', '🔑', '🧵'],
  },
};

const ALL_ICONS = new Set(DEBT_KINDS.flatMap((k) => KIND_META[k].icons));

export function isDebtKind(v: unknown): v is DebtKind {
  return typeof v === 'string' && (DEBT_KINDS as string[]).includes(v);
}

/** Borcun türü; eski kayıtlarda (tür yok) grubun kendisi. */
export function kindOf(d: { kind?: unknown; category: Category }): DebtKind {
  return isDebtKind(d.kind) ? d.kind : isDebtKind(d.category) ? d.category : 'gida';
}

/** Yalnızca bilinen ikonlar gösterilir; değilse türün varsayılan ikonu. */
export function iconOf(d: { icon?: unknown; kind?: unknown; category: Category }): string {
  return typeof d.icon === 'string' && ALL_ICONS.has(d.icon) ? d.icon : KIND_META[kindOf(d)].emoji;
}

/** Türün rengine göre küçük etiket (chip) stili. */
export function kindChipStyle(kind: DebtKind): { color: string; background: string; borderColor: string } {
  const c = KIND_META[kind].color;
  return { color: c, background: `${c}1f`, borderColor: `${c}4d` };
}

// Araştırma grupları (grafikler, raporlar): 4 sabit değer.
export const CATEGORY_META: Record<
  Category,
  { label: string; color: string; emoji: string }
> = {
  gida: { label: 'Temel İhtiyaç', color: '#10b981', emoji: '🧺' },
  egitim: { label: 'Eğitim', color: '#3b82f6', emoji: '📚' },
  fatura: { label: 'Fatura ve Hizmet', color: '#f59e0b', emoji: '💡' },
  saglik: { label: 'Sağlık', color: '#ec4899', emoji: '💊' },
};

// Eski kod yolları için (grup → ikonlar)
export const CATEGORY_ICONS: Record<Category, string[]> = {
  gida: KIND_META.gida.icons,
  egitim: KIND_META.egitim.icons,
  fatura: KIND_META.fatura.icons,
  saglik: KIND_META.saglik.icons,
};
/** Bir borcun alabileceği en yüksek tutar (₺); veritabanı kuralıyla aynı. */
export const MAX_DEBT_AMOUNT = 100000;

/** Kısmi katkı tutarı: 1 ile kalan tutar arasında tam sayı ₺; geçersizse null. */
export function parsePartialAmount(text: string, max: number): number | null {
  // Sunucu tutarı tam sayıya yuvarlar; küsuratı burada reddetmek ekranla sunucuyu aynı tutar.
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount >= 1 && amount <= max ? amount : null;
}

export const SAMPLE_DEBTS: Debt[] = [
  {
    id: 'd1',
    category: 'gida',
    title: 'Ekmek ve süt borcu',
    description: '5 günlük temel gıda ihtiyacı için mahalle bakkalına olan borç.',
    amount: 180,
    urgency: 3,
    icon: '🍞',
  },
  {
    id: 'd2',
    category: 'egitim',
    title: 'Öğrenci defter kalem',
    description: 'İlkokul öğrencisi için kırtasiye malzemeleri.',
    amount: 120,
    urgency: 2,
    icon: '📚',
  },
  {
    id: 'd3',
    category: 'fatura',
    title: 'Elektrik faturası',
    description: 'Geciken elektrik faturası, kesilme riskinde.',
    amount: 350,
    urgency: 3,
    icon: '💡',
  },
  {
    id: 'd4',
    category: 'saglik',
    title: 'İlaç katkı payı',
    description: 'Kronik hasta için reçeteli ilaç ihtiyacı.',
    amount: 95,
    urgency: 3,
    icon: '💊',
  },
  {
    id: 'd5',
    category: 'gida',
    title: 'Bebek maması',
    description: '7 aylık bebek için aylık mama ihtiyacı.',
    amount: 220,
    urgency: 3,
    icon: '🍼',
    kind: 'bebek',
  },
  {
    id: 'd6',
    category: 'fatura',
    title: 'Doğalgaz borcu',
    description: 'Kış ayı doğalgaz faturası.',
    amount: 280,
    urgency: 2,
    icon: '🔥',
  },
  {
    id: 'd7',
    category: 'egitim',
    title: 'Servis ücreti',
    description: 'Lise öğrencisi için bir aylık okul servis ücreti.',
    amount: 450,
    urgency: 2,
    icon: '🚌',
  },
  {
    id: 'd8',
    category: 'gida',
    title: 'Aylık erzak paketi',
    description: 'Pirinç, bulgur, yağ gibi temel kuru gıda.',
    amount: 400,
    urgency: 2,
    icon: '🥫',
  },
  {
    id: 'd9',
    category: 'saglik',
    title: 'Gözlük camı',
    description: 'Numarası değişen öğrenci için yeni gözlük camı.',
    amount: 320,
    urgency: 1,
    icon: '👓',
  },
  {
    id: 'd10',
    category: 'fatura',
    title: 'Su faturası',
    description: 'İki dönemlik birikmiş su faturası.',
    amount: 140,
    urgency: 2,
    icon: '💧',
  },
];

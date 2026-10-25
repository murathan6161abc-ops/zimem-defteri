import type { Debt, Category } from '@/types';

export const CATEGORIES: Category[] = ['gida', 'egitim', 'fatura', 'saglik'];

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  gida: { label: 'Temel Gıda', color: '#10b981' },
  egitim: { label: 'Eğitim', color: '#3b82f6' },
  fatura: { label: 'Fatura', color: '#f59e0b' },
  saglik: { label: 'Sağlık', color: '#ec4899' },
};

/** Bir borcun alabileceği en yüksek tutar (₺); veritabanı kuralıyla aynı. */
export const MAX_DEBT_AMOUNT = 100000;

/** Tutarı binlik ayırıcıyla yazar: 1250 → "1.250 ₺". */
export function formatTL(amount: number, locale = 'tr'): string {
  return `${Math.round(amount).toLocaleString(locale === 'tr' ? 'tr-TR' : locale)} ₺`;
}

/** Kısmi katkı tutarı: 1 ile kalan tutar arasında tam sayı ₺; geçersizse null. */
export function parsePartialAmount(text: string, max: number): number | null {
  // Sunucu tutarı tam sayıya yuvarlar; küsuratı burada reddetmek ekranla sunucuyu aynı tutar.
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount >= 1 && amount <= max ? amount : null;
}

/**
 * Esnafın yazdığı borç tutarı: "1250" ya da "1.250" → 1250. Küsuratlı ya da geçersiz
 * girişte NaN döner; sunucu tam sayı sakladığı için tutar sessizce yuvarlanmaz.
 */
export function parseWholeAmount(text: string): number {
  const trimmed = text.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) return Number(trimmed.replace(/\./g, ''));
  return /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
}

export const SAMPLE_DEBTS: Debt[] = [
  {
    id: 'd1',
    category: 'gida',
    title: 'Ekmek ve süt borcu',
    description: '5 günlük temel gıda ihtiyacı için mahalle bakkalına olan borç.',
    amount: 180,
    urgency: 3,
  },
  {
    id: 'd2',
    category: 'egitim',
    title: 'Öğrenci defter kalem',
    description: 'İlkokul öğrencisi için kırtasiye malzemeleri.',
    amount: 120,
    urgency: 2,
  },
  {
    id: 'd3',
    category: 'fatura',
    title: 'Elektrik faturası',
    description: 'Geciken elektrik faturası, kesilme riskinde.',
    amount: 350,
    urgency: 3,
  },
  {
    id: 'd4',
    category: 'saglik',
    title: 'İlaç katkı payı',
    description: 'Kronik hasta için reçeteli ilaç ihtiyacı.',
    amount: 95,
    urgency: 3,
  },
  {
    id: 'd5',
    category: 'gida',
    title: 'Bebek maması',
    description: '7 aylık bebek için aylık mama ihtiyacı.',
    amount: 220,
    urgency: 3,
  },
  {
    id: 'd6',
    category: 'fatura',
    title: 'Doğalgaz borcu',
    description: 'Kış ayı doğalgaz faturası.',
    amount: 280,
    urgency: 2,
  },
  {
    id: 'd7',
    category: 'egitim',
    title: 'Servis ücreti',
    description: 'Lise öğrencisi için bir aylık okul servis ücreti.',
    amount: 450,
    urgency: 2,
  },
  {
    id: 'd8',
    category: 'gida',
    title: 'Aylık erzak paketi',
    description: 'Pirinç, bulgur, yağ gibi temel kuru gıda.',
    amount: 400,
    urgency: 2,
  },
  {
    id: 'd9',
    category: 'saglik',
    title: 'Gözlük camı',
    description: 'Numarası değişen öğrenci için yeni gözlük camı.',
    amount: 320,
    urgency: 1,
  },
  {
    id: 'd10',
    category: 'fatura',
    title: 'Su faturası',
    description: 'İki dönemlik birikmiş su faturası.',
    amount: 140,
    urgency: 2,
  },
];

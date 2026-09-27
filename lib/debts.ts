import type { Debt, Category } from '@/types';

// Esnafın borç kaydında seçebileceği ikonlar (ilk öğe varsayılan).
export const CATEGORY_ICONS: Record<Category, string[]> = {
  gida: ['🍞', '🥫', '🍼', '🥛', '🥚', '🍎', '🥬'],
  egitim: ['📚', '✏️', '🚌', '🎒', '📓', '🖍️'],
  fatura: ['💡', '🔥', '💧', '📱', '📺'],
  saglik: ['💊', '👓', '🩹', '🦷', '🩺'],
};

export const CATEGORY_META: Record<
  Category,
  { label: string; color: string; emoji: string }
> = {
  gida: { label: 'Temel Gıda', color: '#10b981', emoji: '🍞' },
  egitim: { label: 'Eğitim', color: '#3b82f6', emoji: '📚' },
  fatura: { label: 'Fatura', color: '#f59e0b', emoji: '💡' },
  saglik: { label: 'Sağlık', color: '#ec4899', emoji: '💊' },
};

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

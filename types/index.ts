// Araştırma grubu (TÜBİTAK analizleri ve veritabanı `category` sütunu): 4 sabit değer.
export type Category = 'gida' | 'egitim' | 'fatura' | 'saglik';

// Borcun ayrıntılı türü (esnafın seçtiği, kartlarda görünen). Her tür bir gruba bağlıdır.
export type DebtKind =
  | 'gida'
  | 'bebek'
  | 'temizlik'
  | 'saglik'
  | 'egitim'
  | 'giyim'
  | 'yakacak'
  | 'fatura'
  | 'ulasim'
  | 'diger';

export interface Debt {
  id: string;
  category: Category;
  title: string;
  description: string;
  amount: number;
  urgency: 1 | 2 | 3;
  icon: string;
  kind?: DebtKind; // yoksa category'den türetilir (eski kayıtlar)
}

export interface PreTestData {
  huzur: number; // 1-10
  emotion: 'merak' | 'sorumluluk' | 'huzur' | 'heyecan';
  emotionValue: number; // 1-4
  likert: number; // 1-5
  // PANAS-SF Negatif Afekt: 5 madde × 1-5 likert (akademik standart)
  panasNeg?: Record<string, number>;
}

export interface PostTestData {
  huzur: number; // 1-10 — iyilik sonrası ölçülen huzur (pre ile karşılaştırmalı)
  emotion: 'mutlu' | 'dingin' | 'hafiflemis' | 'gururlu';
  emotionValue: number; // 1-4
  likert: number; // 1-5
  willRepeat: 'evet' | 'belki' | 'bilmiyorum';
  // PANAS-SF Pozitif Afekt: 5 madde × 1-5 likert
  panasPos?: Record<string, number>;
}

// WHO-5 İyilik Hali İndeksi ölçümü (haftalık)
export interface WHO5Measurement {
  id: string;
  user_id: string;
  scores: Record<string, number>; // q1..q5, her biri 0-5
  total: number; // 0-25 ham, ×4 = 0-100 normalize
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  debtId: string;
  date: string; // ISO
  category: Category;
  title: string;
  amount: number;
  xp: number;
  preEmotion: PreTestData['emotion'];
  postEmotion: PostTestData['emotion'];
  willRepeat: PostTestData['willRepeat'];
  urgency: number;
  kind?: DebtKind; // bu cihazda ödenenlerde; sunucudan yeniden kurulan geçmişte yok
  icon?: string;
}

export interface Achievement {
  id: string;
  nameKey: string;
  descKey: string;
  emoji: string;
}

export interface LevelInfo {
  index: number;
  key: string;
  minXP: number;
  emoji: string;
}

export type ModalStep = 'closed' | 'pretest' | 'payment' | 'posttest' | 'result';

export type Role = 'vatandas' | 'esnaf';

export interface UserProfile {
  role: Role;
  displayName: string;
  username?: string; // giriş için kullanıcı adı (Supabase Auth)
  shopName?: string; // esnaf için
  city?: string;
  createdAt: string;
  // Bilgilendirilmiş onam (informed consent) zaman damgası — araştırma etiği
  consentAt?: string;
  // Yaş grubu (doğum tarihi tutulmaz) ve 18 yaş altı için velinin imzalı onam beyanı
  ageGroup?: 'minor' | 'adult';
  guardianConsentAt?: string;
}

export interface MerchantDebt extends Debt {
  addedBy: string; // displayName
  addedAt: string; // ISO
  closed?: boolean;
  closedAt?: string;
}

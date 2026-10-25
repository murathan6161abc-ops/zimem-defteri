export type Category = 'gida' | 'egitim' | 'fatura' | 'saglik';

export interface Debt {
  id: string;
  category: Category;
  title: string;
  description: string;
  amount: number;
  urgency: 1 | 2 | 3;
}

export interface PreTestData {
  huzur: number; // 1-10
  emotion: 'merak' | 'sorumluluk' | 'huzur' | 'heyecan';
  emotionValue: number; // 1-4
  likert: number; // 1-5
  // PANAS negatif afekt: 5 madde, 1-5 arası
  panasNeg?: Record<string, number>;
}

export interface PostTestData {
  huzur: number; // 1-10, ön testteki huzur sorusuyla aynı
  emotion: 'mutlu' | 'dingin' | 'hafiflemis' | 'gururlu';
  emotionValue: number; // 1-4
  likert: number; // 1-5
  willRepeat: 'evet' | 'belki' | 'bilmiyorum';
  // PANAS pozitif afekt: 5 madde, 1-5 arası
  panasPos?: Record<string, number>;
}

// WHO-5 ölçümü (haftada bir)
export interface WHO5Measurement {
  id: string;
  user_id: string;
  scores: Record<string, number>; // q1..q5, her biri 0-5
  total: number; // 0-100 (ham toplam × 4)
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
}

export interface Achievement {
  id: string;
  nameKey: string;
  descKey: string;
  mark: string; // rozetin içinde yazan kısa ifade (ör. "5", "1K")
}

export interface LevelInfo {
  index: number;
  key: string;
  minXP: number;
}

export type ModalStep = 'closed' | 'pretest' | 'payment' | 'posttest' | 'result';

export type Role = 'vatandas' | 'esnaf';

export interface UserProfile {
  role: Role;
  displayName: string;
  username?: string; // giriş için kullanıcı adı ya da e-posta
  shopName?: string; // esnaf için
  city?: string;
  createdAt: string;
  // Araştırma onamının verildiği an
  consentAt?: string;
}

export interface MerchantDebt extends Debt {
  addedBy: string; // dükkan adı ya da takma ad
  addedAt: string; // ISO
  closed?: boolean;
  closedAt?: string;
}

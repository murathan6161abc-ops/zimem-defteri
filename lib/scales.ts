// ============================================================
// Psikometrik Ölçekler
// PANAS-SF (Positive and Negative Affect Schedule — Kısa Form)
// WHO-5 İyilik Hali İndeksi
// Akademik geçerli, dünya çapında kullanılan ölçekler.
// ============================================================

export interface ScaleItem {
  key: string;       // veritabanı/JSON anahtarı
  i18nKey: string;   // çeviri sözlüğü yolu
}

// ─── PANAS-SF Negatif Afekt ─────────────────────────────────
// Watson, Clark & Tellegen (1988) — Türkçe uyarlama: Gençöz (2000)
// 5 madde × 1-5 Likert → toplam 5-25
// Pre-test'te uygulanır (kişinin ana baz halinin negatif duygu durumu)
export const PANAS_NEGATIVE: ScaleItem[] = [
  { key: 'tense',  i18nKey: 'panas.neg_tense'  },
  { key: 'angry',  i18nKey: 'panas.neg_angry'  },
  { key: 'afraid', i18nKey: 'panas.neg_afraid' },
  { key: 'guilty', i18nKey: 'panas.neg_guilty' },
  { key: 'upset',  i18nKey: 'panas.neg_upset'  },
];

// ─── PANAS-SF Pozitif Afekt ─────────────────────────────────
// 5 madde × 1-5 Likert → toplam 5-25
// Post-test'te uygulanır (iyilik sonrası pozitif duygu durumu)
export const PANAS_POSITIVE: ScaleItem[] = [
  { key: 'excited',    i18nKey: 'panas.pos_excited'    },
  { key: 'interested', i18nKey: 'panas.pos_interested' },
  { key: 'attentive',  i18nKey: 'panas.pos_attentive'  },
  { key: 'determined', i18nKey: 'panas.pos_determined' },
  { key: 'active',     i18nKey: 'panas.pos_active'     },
];

// ─── WHO-5 İyilik Hali İndeksi ──────────────────────────────
// Topp et al. (2015) — Türkçe geçerlilik: Eser et al.
// 5 madde × 0-5 Likert (son 2 hafta) → toplam ×4 = 0-100 skoru
// 50 altı: düşük iyilik hali (uzman görüşü öneriyor)
// 51-70: orta
// 71+: yüksek
export const WHO5_ITEMS: ScaleItem[] = [
  { key: 'q1', i18nKey: 'who5.q1' },
  { key: 'q2', i18nKey: 'who5.q2' },
  { key: 'q3', i18nKey: 'who5.q3' },
  { key: 'q4', i18nKey: 'who5.q4' },
  { key: 'q5', i18nKey: 'who5.q5' },
];

// ─── Hesaplama yardımcıları ──────────────────────────────────

export function panasTotal(scores: Record<string, number> | undefined): number {
  if (!scores) return 0;
  return Object.values(scores).reduce((sum, v) => sum + (v || 0), 0);
}

/** WHO-5 ham skor (0-25) → normalize edilmiş skor (0-100) */
export function who5Total(scores: Record<string, number>): number {
  const raw = Object.values(scores).reduce((sum, v) => sum + (v || 0), 0);
  return raw * 4; // 25 × 4 = 100
}

export type WHO5Category = 'low' | 'mid' | 'high';

export function who5Category(normalized: number): WHO5Category {
  if (normalized >= 71) return 'high';
  if (normalized >= 51) return 'mid';
  return 'low';
}

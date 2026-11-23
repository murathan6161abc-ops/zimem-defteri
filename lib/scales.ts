// Psikometrik Ölçekler
// PANAS (Positive and Negative Affect Schedule) — 10 maddelik seçki
// WHO-5 İyilik Hali İndeksi

export interface ScaleItem {
  key: string;       // veritabanı/JSON anahtarı
  i18nKey: string;   // çeviri sözlüğü yolu
}

// PANAS: Watson, Clark & Tellegen (1988); Türkçe uyarlama (20 madde): Gençöz (2000).
// DİKKAT: Aşağıdaki 5 + 5 madde 20 maddelik formdan seçilmiştir; uluslararası kısa
// form I-PANAS-SF (Thompson, 2007) ile aynı değildir. Madde seti ve Türkçe ifadeler
// danışmanla, geçerlik çalışması olan bir formla eşleştirilmelidir. Madde değişirse
// key'ler aynı kalabilir; yalnızca i18n metinleri ve bu listeler güncellenir.
//
// Her iki alt ölçek hem ön testte hem son testte sorulur: ön-son karşılaştırması
// ancak aynı maddeler iki ölçümde de sorulursa yapılabilir.
// Her madde 1-5 Likert → alt ölçek toplamı 5-25.

/** Negatif duygulanım */
export const PANAS_NEGATIVE: ScaleItem[] = [
  { key: 'tense',  i18nKey: 'panas.neg_tense'  },
  { key: 'angry',  i18nKey: 'panas.neg_angry'  },
  { key: 'afraid', i18nKey: 'panas.neg_afraid' },
  { key: 'guilty', i18nKey: 'panas.neg_guilty' },
  { key: 'upset',  i18nKey: 'panas.neg_upset'  },
];

/** Pozitif duygulanım */
export const PANAS_POSITIVE: ScaleItem[] = [
  { key: 'excited',    i18nKey: 'panas.pos_excited'    },
  { key: 'interested', i18nKey: 'panas.pos_interested' },
  { key: 'attentive',  i18nKey: 'panas.pos_attentive'  },
  { key: 'determined', i18nKey: 'panas.pos_determined' },
  { key: 'active',     i18nKey: 'panas.pos_active'     },
];

/**
 * Ekranda gösterim sırası: PANAS'ta olduğu gibi olumlu ve olumsuz maddeler karışık
 * sunulur (hepsi art arda gelince yanıtlar birbirini etkiler). Ön ve son testte aynı sıra.
 */
export const PANAS_DISPLAY_ORDER: ScaleItem[] = [
  PANAS_POSITIVE[1], PANAS_NEGATIVE[3], PANAS_POSITIVE[0], PANAS_NEGATIVE[0], PANAS_POSITIVE[3],
  PANAS_NEGATIVE[2], PANAS_POSITIVE[2], PANAS_NEGATIVE[4], PANAS_POSITIVE[4], PANAS_NEGATIVE[1],
];

/** Formdaki 10 cevabı iki alt ölçeğe ayırır; madde eksikse null (bölüm tamamlanmamış). */
export function splitPanas(
  answers: Record<string, number>,
): { panasNeg: Record<string, number>; panasPos: Record<string, number> } | null {
  const pick = (items: ScaleItem[]) => {
    const out: Record<string, number> = {};
    for (const it of items) {
      const v = answers[it.key];
      if (!Number.isInteger(v) || v < 1 || v > 5) return null;
      out[it.key] = v;
    }
    return out;
  };
  const panasNeg = pick(PANAS_NEGATIVE);
  const panasPos = pick(PANAS_POSITIVE);
  return panasNeg && panasPos ? { panasNeg, panasPos } : null;
}

// WHO-5 İyilik Hali İndeksi
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

// Hesaplama yardımcıları

/** Alt ölçek toplamı (5-25). Bölüm atlandıysa null: 0 geçerli bir PANAS toplamı değildir. */
export function panasTotal(scores: Record<string, number> | undefined): number | null {
  if (!scores) return null;
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

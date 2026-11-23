// Yönetim panelindeki araştırma çıktıları: çıkarımsal istatistik özeti, anonim CSV ve
// veri sözlüğü. Saf fonksiyonlardır (tarayıcı ve testte aynı çalışır).
import { PANAS_NEGATIVE, PANAS_POSITIVE } from './scales';
import { cronbachAlpha, formatP, mean, pairedTTest, wilcoxonSignedRank } from './stats';

/** Analizde kullanılan anket satırı (survey_submissions). */
export interface ResearchRow {
  user_id: string;
  created_at: string;
  debt_category: string;
  debt_amount: number;
  debt_urgency: number;
  pre_huzur: number | null;
  post_huzur: number | null;
  pre_emotion: string | null;
  post_emotion: string | null;
  pre_emotion_value: number | null;
  post_emotion_value: number | null;
  pre_likert: number | null;
  post_likert: number | null;
  will_repeat: string | null;
  // PANAS. Eski sütun adları: panas_neg_* = ön test negatif, panas_pos_* = son test pozitif.
  panas_neg_total: number | null;
  panas_pos_total: number | null;
  panas_neg_scores?: Record<string, number> | null;
  panas_pos_scores?: Record<string, number> | null;
  // 2.9.0'dan itibaren eksik iki ölçüm de var; eski gönderimlerde boş.
  pre_panas_pos_total?: number | null;
  post_panas_neg_total?: number | null;
  pre_panas_pos_scores?: Record<string, number> | null;
  post_panas_neg_scores?: Record<string, number> | null;
  age_group: 'minor' | 'adult' | null;
  app_version: string | null;
}

type Pair = { before: number; after: number };

/** Bir gönderimden ön ve son ölçümü seçer; biri eksikse çift oluşmaz. */
type Measure = (r: ResearchRow) => [number | null | undefined, number | null | undefined];

const HUZUR: Measure = (r) => [r.pre_huzur, r.post_huzur];
/** PANAS pozitif duygu: ön test (yeni sütun) → son test. */
export const PANAS_POS: Measure = (r) => [r.pre_panas_pos_total, r.panas_pos_total];
/** PANAS negatif duygu: ön test → son test (yeni sütun). */
export const PANAS_NEG: Measure = (r) => [r.panas_neg_total, r.post_panas_neg_total];

function pairOf(r: ResearchRow, measure: Measure): Pair | null {
  const [before, after] = measure(r);
  return typeof before === 'number' && typeof after === 'number' ? { before, after } : null;
}

/** Her gönderim bir çift: ön ve son test puanı. */
function submissionPairs(rows: ResearchRow[], measure: Measure = HUZUR): Pair[] {
  return rows.map((r) => pairOf(r, measure)).filter((p): p is Pair => p !== null);
}

/**
 * Katılımcı düzeyi: aynı kişinin birden çok gönderimi tek çifte (ortalamalara) indirilir.
 * Gönderimler bağımsız değildir; t testi için asıl birim katılımcıdır.
 */
export function participantPairs(rows: ResearchRow[], measure: Measure = HUZUR): Pair[] {
  const byUser = new Map<string, Pair[]>();
  for (const r of rows) {
    const pair = pairOf(r, measure);
    if (!pair) continue;
    const list = byUser.get(r.user_id) ?? [];
    list.push(pair);
    byUser.set(r.user_id, list);
  }
  return [...byUser.values()].map((list) => ({
    before: mean(list.map((p) => p.before)),
    after: mean(list.map((p) => p.after)),
  }));
}

function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function testLines(label: string, pairs: Pair[]): string {
  const before = pairs.map((p) => p.before);
  const after = pairs.map((p) => p.after);
  const t = pairedTTest(before, after);
  const w = wilcoxonSignedRank(before, after);
  if (!t) return `- ${label}: hesaplanamadı (en az 2 çift ve farklarda değişkenlik gerekir; n = ${pairs.length})`;
  const lines = [
    `- ${label} (n = ${t.n}): ön ${fmt(t.meanBefore)} → son ${fmt(t.meanAfter)}, fark ${fmt(t.meanDiff)} (SS ${fmt(t.sdDiff)})`,
    `  - Eşleştirilmiş t testi: t(${t.df}) = ${fmt(t.t)}, ${formatP(t.p)}, %95 GA [${fmt(t.ci95[0])}, ${fmt(t.ci95[1])}], Cohen dz = ${fmt(t.cohenDz)}`,
  ];
  if (w) lines.push(`  - Wilcoxon işaretli sıra: z = ${fmt(w.z)}, ${formatP(w.p)}, r = ${fmt(w.r)} (sıfır olmayan fark: ${w.n})`);
  return lines.join('\n');
}

type ScoreField = 'panas_neg_scores' | 'panas_pos_scores' | 'pre_panas_pos_scores' | 'post_panas_neg_scores';

function alphaLine(label: string, rows: ResearchRow[], field: ScoreField, keys: string[]): string {
  const items = rows
    .map((r) => r[field])
    .filter((s): s is Record<string, number> => !!s)
    .map((s) => keys.map((k) => Number(s[k])));
  const a = cronbachAlpha(items);
  return a
    ? `- ${label}: α = ${fmt(a.alpha)} (${a.k} madde, ${a.n} tam yanıt)`
    : `- ${label}: hesaplanamadı (en az 2 tam yanıt gerekir)`;
}

/** Araştırma özetine eklenen çıkarımsal istatistik bölümü (Markdown). */
export function buildStatsMarkdown(rows: ResearchRow[]): string {
  const groups: { label: string; rows: ResearchRow[] }[] = [
    { label: '18 yaş altı', rows: rows.filter((r) => r.age_group === 'minor') },
    { label: '18 yaş ve üstü', rows: rows.filter((r) => r.age_group === 'adult') },
    { label: 'Yaş grubu bilinmeyen', rows: rows.filter((r) => r.age_group === null) },
  ].filter((g) => g.rows.length > 0);

  const negKeys = PANAS_NEGATIVE.map((i) => i.key);
  const posKeys = PANAS_POSITIVE.map((i) => i.key);

  return `## Çıkarımsal İstatistik

Birim katılımcıdır: aynı kişinin birden çok gönderimi ortalamaya indirilir. Gönderim
düzeyi sonuç yalnızca karşılaştırma içindir (gönderimler birbirinden bağımsız değildir).

### Huzur (1-10)

${testLines('Katılımcı düzeyi', participantPairs(rows))}
${testLines('Gönderim düzeyi', submissionPairs(rows))}

#### Yaş gruplarına göre (katılımcı düzeyi)

${groups.map((g) => testLines(g.label, participantPairs(g.rows))).join('\n') || '- Veri yok'}

### PANAS (5-25, katılımcı düzeyi)

Yalnızca PANAS bölümünü hem ön hem son testte dolduran gönderimler çift oluşturur.

${testLines('Pozitif duygu', participantPairs(rows, PANAS_POS))}
${testLines('Negatif duygu', participantPairs(rows, PANAS_NEG))}

## Güvenirlik (Cronbach alfa)

${alphaLine('PANAS pozitif duygu, ön test', rows, 'pre_panas_pos_scores', posKeys)}
${alphaLine('PANAS pozitif duygu, son test', rows, 'panas_pos_scores', posKeys)}
${alphaLine('PANAS negatif duygu, ön test', rows, 'panas_neg_scores', negKeys)}
${alphaLine('PANAS negatif duygu, son test', rows, 'post_panas_neg_scores', negKeys)}

## Yöntem notları

- PANAS'ın iki alt ölçeği 2.9.0'dan itibaren hem ön hem son testte aynı maddelerle
  soruluyor. Daha eski gönderimlerde yalnızca ön test negatif ve son test pozitif duygu
  vardır; bu gönderimler PANAS ön-son karşılaştırmasına girmez.
- PANAS maddeleri 20 maddelik formdan seçilmiş 5 + 5 maddedir; doğrulanmış bir kısa
  form (ör. I-PANAS-SF) değildir. Raporda bu belirtilmeli, alfa değerleri verilmelidir.
- PANAS bölümü isteğe bağlıdır; dolduranlar örneklemin seçilmiş bir alt kümesi olabilir.
- Ön testteki ve son testteki tekil likert maddeleri farklı sorulardır; aralarında fark alınmaz.
- Kontrol grubu olmadığından görülen değişim yalnızca iyilik davranışına bağlanamaz.
- p değerleri bu panelde sayısal yöntemle hesaplanır; raporda kullanmadan önce JASP/SPSS ile doğrulayın.
`;
}

// ─── Anonim dışa aktarma ─────────────────────────────────────────

const ANON_COLUMNS = [
  'katilimci',
  'yas_grubu',
  'tarih',
  'kategori',
  'tutar',
  'aciliyet',
  'on_huzur',
  'son_huzur',
  'on_duygu',
  'on_duygu_deger',
  'son_duygu',
  'son_duygu_deger',
  'on_madde',
  'son_madde',
  'tekrar_niyeti',
  'on_panas_pozitif_toplam',
  ...PANAS_POSITIVE.map((i) => `on_panas_pos_${i.key}`),
  'on_panas_negatif_toplam',
  ...PANAS_NEGATIVE.map((i) => `on_panas_neg_${i.key}`),
  'son_panas_pozitif_toplam',
  ...PANAS_POSITIVE.map((i) => `son_panas_pos_${i.key}`),
  'son_panas_negatif_toplam',
  ...PANAS_NEGATIVE.map((i) => `son_panas_neg_${i.key}`),
  'surum',
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Takma ad, şehir, borç başlığı, esnaf adı ve hesap kimliği çıkarılmış CSV. Katılımcılar
 * ilk gönderim sırasına göre K001, K002… kodlarıyla gösterilir; tarih yalnızca gün olarak yazılır.
 */
export function anonymizedCsv(rows: ResearchRow[]): string {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const codes = new Map<string, string>();
  for (const r of ordered) {
    if (!codes.has(r.user_id)) codes.set(r.user_id, `K${String(codes.size + 1).padStart(3, '0')}`);
  }
  const lines = ordered.map((r) =>
    [
      codes.get(r.user_id),
      r.age_group ?? '',
      r.created_at.slice(0, 10),
      r.debt_category,
      r.debt_amount,
      r.debt_urgency,
      r.pre_huzur,
      r.post_huzur,
      r.pre_emotion,
      r.pre_emotion_value,
      r.post_emotion,
      r.post_emotion_value,
      r.pre_likert,
      r.post_likert,
      r.will_repeat,
      r.pre_panas_pos_total ?? null,
      ...PANAS_POSITIVE.map((i) => r.pre_panas_pos_scores?.[i.key] ?? null),
      r.panas_neg_total,
      ...PANAS_NEGATIVE.map((i) => r.panas_neg_scores?.[i.key] ?? null),
      r.panas_pos_total,
      ...PANAS_POSITIVE.map((i) => r.panas_pos_scores?.[i.key] ?? null),
      r.post_panas_neg_total ?? null,
      ...PANAS_NEGATIVE.map((i) => r.post_panas_neg_scores?.[i.key] ?? null),
      r.app_version,
    ]
      .map(csvCell)
      .join(','),
  );
  return [ANON_COLUMNS.join(','), ...lines].join('\n');
}

/** Anonim CSV'deki her sütunun anlamı (rapor ekine konabilir). */
export const DATA_DICTIONARY = `# D-Zimem Veri Sözlüğü (anonim CSV)

| Sütun | Açıklama | Değerler |
| --- | --- | --- |
| katilimci | Katılımcı kodu (ilk gönderim sırasına göre). Hesap kimliği ve takma ad dışa aktarılmaz. | K001, K002… |
| yas_grubu | Kayıtta beyan edilen yaş grubu | minor (18 altı), adult (18+), boş (bilinmiyor) |
| tarih | Gönderimin günü | YYYY-AA-GG |
| kategori | Kapatılan borcun araştırma grubu | gida, egitim, fatura, saglik |
| tutar | Kapatılan / katkı yapılan tutar (₺, simülasyon) | 1–100000 |
| aciliyet | Borcun aciliyeti | 1 düşük, 2 orta, 3 yüksek |
| on_huzur / son_huzur | "Şu an huzur seviyen nedir?" (ön ve son testte aynı soru) | 1–10 |
| on_duygu / son_duygu | Seçilen baskın duygu | ön: merak, sorumluluk, huzur, heyecan; son: mutlu, dingin, hafiflemis, gururlu |
| on_duygu_deger / son_duygu_deger | Duygu seçiminin sayısal karşılığı | 1–4 |
| on_madde | Ön test: "Sosyal dayanışmaya katılmak senin için ne kadar değerli?" | 1–5 |
| son_madde | Son test likert maddesi ("iyilik şifadır"); on_madde ile farklı soru | 1–5 |
| tekrar_niyeti | Yeniden iyilik yapma niyeti | evet, belki, bilmiyorum |
| on_panas_pozitif_toplam / son_panas_pozitif_toplam | PANAS pozitif duygu toplamı, ön / son test; atlandıysa boş | 5–25 |
| on_panas_pos_* / son_panas_pos_* | Pozitif duygu maddeleri (excited, interested, attentive, determined, active) | 1–5 |
| on_panas_negatif_toplam / son_panas_negatif_toplam | PANAS negatif duygu toplamı, ön / son test; atlandıysa boş | 5–25 |
| on_panas_neg_* / son_panas_neg_* | Negatif duygu maddeleri (tense, angry, afraid, guilty, upset) | 1–5 |
| surum | Gönderimi yapan uygulama sürümü | ör. 2.8.0 |

Notlar:
- Her satır bir gönderimdir; bir katılımcının birden çok satırı olabilir. Ön-son analizinde
  katılımcı düzeyine indirgeme yapılmalıdır.
- Takma ad, şehir, borç başlığı ve esnaf adı serbest metin olduğu için dışa aktarılmaz.
- 2.9.0 öncesi gönderimlerde on_panas_pozitif ve son_panas_negatif sütunları boştur
  (o sürümler bu iki ölçümü sormuyordu).
- PANAS maddeleri 20 maddelik formdan seçilmiş 5 + 5 maddedir (doğrulanmış kısa form değil).
`;

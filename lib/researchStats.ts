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
  panas_neg_total: number | null;
  panas_pos_total: number | null;
  panas_neg_scores?: Record<string, number> | null;
  panas_pos_scores?: Record<string, number> | null;
  age_group: 'minor' | 'adult' | null;
  app_version: string | null;
}

type Pair = { before: number; after: number };

/** Her gönderim bir çift: ön ve son test huzur puanı. */
function submissionPairs(rows: ResearchRow[]): Pair[] {
  return rows
    .filter((r) => r.pre_huzur !== null && r.post_huzur !== null)
    .map((r) => ({ before: r.pre_huzur as number, after: r.post_huzur as number }));
}

/**
 * Katılımcı düzeyi: aynı kişinin birden çok gönderimi tek çifte (ortalamalara) indirilir.
 * Gönderimler bağımsız değildir; t testi için asıl birim katılımcıdır.
 */
export function participantPairs(rows: ResearchRow[]): Pair[] {
  const byUser = new Map<string, Pair[]>();
  for (const r of rows) {
    if (r.pre_huzur === null || r.post_huzur === null) continue;
    const list = byUser.get(r.user_id) ?? [];
    list.push({ before: r.pre_huzur, after: r.post_huzur });
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

function alphaLine(label: string, rows: ResearchRow[], field: 'panas_neg_scores' | 'panas_pos_scores', keys: string[]): string {
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

  return `## Çıkarımsal İstatistik (huzur, 1-10)

Birim katılımcıdır: aynı kişinin birden çok gönderimi ortalamaya indirilir. Gönderim
düzeyi sonuç yalnızca karşılaştırma içindir (gönderimler birbirinden bağımsız değildir).

${testLines('Katılımcı düzeyi', participantPairs(rows))}
${testLines('Gönderim düzeyi', submissionPairs(rows))}

### Yaş gruplarına göre (katılımcı düzeyi)

${groups.map((g) => testLines(g.label, participantPairs(g.rows))).join('\n') || '- Veri yok'}

## Güvenirlik (Cronbach alfa)

${alphaLine('PANAS negatif duygu (ön test)', rows, 'panas_neg_scores', PANAS_NEGATIVE.map((i) => i.key))}
${alphaLine('PANAS pozitif duygu (son test)', rows, 'panas_pos_scores', PANAS_POSITIVE.map((i) => i.key))}

## Yöntem notları

- Uygulamada PANAS negatif duygu yalnızca ön testte, pozitif duygu yalnızca son testte
  soruluyor; bu yüzden PANAS için ön-son karşılaştırması yapılamaz. Ön-son karşılaştırma
  istenirse iki alt ölçek her iki ölçümde de sorulmalıdır.
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
  'panas_negatif_toplam',
  ...PANAS_NEGATIVE.map((i) => `panas_neg_${i.key}`),
  'panas_pozitif_toplam',
  ...PANAS_POSITIVE.map((i) => `panas_pos_${i.key}`),
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
      r.panas_neg_total,
      ...PANAS_NEGATIVE.map((i) => r.panas_neg_scores?.[i.key] ?? null),
      r.panas_pos_total,
      ...PANAS_POSITIVE.map((i) => r.panas_pos_scores?.[i.key] ?? null),
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
| panas_negatif_toplam | PANAS kısa form negatif duygu toplamı (ön test); atlandıysa boş | 5–25 |
| panas_neg_* | Negatif duygu maddeleri (tense, angry, afraid, guilty, upset) | 1–5 |
| panas_pozitif_toplam | PANAS kısa form pozitif duygu toplamı (son test); atlandıysa boş | 5–25 |
| panas_pos_* | Pozitif duygu maddeleri (excited, interested, attentive, determined, active) | 1–5 |
| surum | Gönderimi yapan uygulama sürümü | ör. 2.8.0 |

Notlar:
- Her satır bir gönderimdir; bir katılımcının birden çok satırı olabilir. Ön-son analizinde
  katılımcı düzeyine indirgeme yapılmalıdır.
- Takma ad, şehir, borç başlığı ve esnaf adı serbest metin olduğu için dışa aktarılmaz.
`;

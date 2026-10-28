// Araştırma raporu için çıkarımsal istatistik: eşleştirilmiş t testi, Wilcoxon işaretli
// sıra testi, Cohen dz, %95 güven aralığı ve Cronbach alfa. Harici kütüphane kullanmaz;
// t ve normal dağılım olasılıkları sayısal yöntemlerle hesaplanır (JASP/SPSS ile 3-4
// ondalığa kadar aynı sonucu verir). Rapordaki asıl analiz yine JASP/SPSS ile
// doğrulanmalıdır; bu panel veri toplanırken hızlı bir bakış içindir.

export function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Örneklem standart sapması (n − 1). */
export function sampleSd(values: number[]): number {
  if (values.length < 2) return NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

// ─── Dağılımlar ────────────────────────────────────────────────

/** Standart normal birikimli dağılım (Abramowitz–Stegun 7.1.26, hata < 1.5e-7). */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function logGamma(x: number): number {
  // Lanczos yaklaşımı (g = 7)
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const tiny = 1e-30;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  return h;
}

/** Düzenlenmiş tamamlanmamış beta fonksiyonu I_x(a, b). */
function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Student t için iki yönlü p değeri. */
export function tTwoTailedP(t: number, df: number): number {
  return regularizedBeta(df / (df + t * t), df / 2, 0.5);
}

/** İki yönlü %(1 − alpha) güven aralığı için kritik t değeri (ör. alpha = 0.05). */
export function tCritical(df: number, alpha = 0.05): number {
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoTailedP(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ─── Testler ───────────────────────────────────────────────────

export interface PairedTTest {
  n: number;
  meanBefore: number;
  meanAfter: number;
  meanDiff: number;
  sdDiff: number;
  t: number;
  df: number;
  p: number;
  ci95: [number, number];
  /** Eşleştirilmiş örneklem etki büyüklüğü: ortalama fark / farkların SS'si. */
  cohenDz: number;
}

/** Eşleştirilmiş t testi (son − ön). En az 2 çift ve farklarda değişkenlik gerekir. */
export function pairedTTest(before: number[], after: number[]): PairedTTest | null {
  if (before.length !== after.length || before.length < 2) return null;
  const diffs = after.map((v, i) => v - before[i]);
  const n = diffs.length;
  const meanDiff = mean(diffs);
  const sdDiff = sampleSd(diffs);
  if (!(sdDiff > 0)) return null;
  const se = sdDiff / Math.sqrt(n);
  const t = meanDiff / se;
  const df = n - 1;
  const margin = tCritical(df) * se;
  return {
    n,
    meanBefore: mean(before),
    meanAfter: mean(after),
    meanDiff,
    sdDiff,
    t,
    df,
    p: tTwoTailedP(t, df),
    ci95: [meanDiff - margin, meanDiff + margin],
    cohenDz: meanDiff / sdDiff,
  };
}

export interface WilcoxonTest {
  /** Sıfır olmayan fark sayısı (testte kullanılan çift). */
  n: number;
  wPlus: number;
  z: number;
  p: number;
  /** Etki büyüklüğü r = |z| / √n. */
  r: number;
}

/** Wilcoxon işaretli sıra testi (normal yaklaşım, bağ ve süreklilik düzeltmeli). */
export function wilcoxonSignedRank(before: number[], after: number[]): WilcoxonTest | null {
  if (before.length !== after.length) return null;
  const diffs = after.map((v, i) => v - before[i]).filter((d) => d !== 0);
  const n = diffs.length;
  if (n < 2) return null;
  const sorted = diffs.map((d) => ({ d, abs: Math.abs(d) })).sort((x, y) => x.abs - y.abs);
  const ranks = new Array<number>(n);
  let tieCorrection = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && sorted[j + 1].abs === sorted[i].abs) j++;
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    const ties = j - i + 1;
    tieCorrection += ties ** 3 - ties;
    i = j + 1;
  }
  const wPlus = sorted.reduce((sum, item, i) => sum + (item.d > 0 ? ranks[i] : 0), 0);
  const expected = (n * (n + 1)) / 4;
  const variance = (n * (n + 1) * (2 * n + 1)) / 24 - tieCorrection / 48;
  if (!(variance > 0)) return null;
  const deviation = wPlus - expected;
  const corrected = deviation === 0 ? 0 : deviation - Math.sign(deviation) * 0.5;
  const z = corrected / Math.sqrt(variance);
  return { n, wPlus, z, p: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))), r: Math.abs(z) / Math.sqrt(n) };
}

/**
 * Cronbach alfa. rows: her katılımcı için madde puanları (aynı sırada). Eksik maddesi olan
 * satırlar dışarıda bırakılır. En az 2 madde ve 2 tam satır gerekir.
 */
export function cronbachAlpha(rows: number[][]): { alpha: number; n: number; k: number } | null {
  if (rows.length === 0) return null;
  const k = rows[0].length;
  const complete = rows.filter((r) => r.length === k && r.every((v) => Number.isFinite(v)));
  if (k < 2 || complete.length < 2) return null;
  const itemVariance = Array.from({ length: k }, (_, i) => sampleSd(complete.map((r) => r[i])) ** 2);
  const totalVariance = sampleSd(complete.map((r) => r.reduce((s, v) => s + v, 0))) ** 2;
  if (!(totalVariance > 0)) return null;
  const alpha = (k / (k - 1)) * (1 - itemVariance.reduce((s, v) => s + v, 0) / totalVariance);
  return { alpha, n: complete.length, k };
}

/** p değerini raporlama biçiminde yazar (APA: p < .001). */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.001) return 'p < .001';
  return `p = ${p.toFixed(3).replace(/^0/, '')}`;
}

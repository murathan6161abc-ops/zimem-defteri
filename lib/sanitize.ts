// ============================================================
// Input sanitization — XSS ve veri sızıntısı önleme
// React varsayılan olarak escape eder ama Supabase'e yazılan
// veriyi her halükarda temizliyoruz (defense in depth).
// ============================================================

const MAX_TITLE = 100;
const MAX_DESC = 500;
const MAX_NAME = 50;
const MAX_CITY = 50;

// HTML/script taglarını temizle, kontrol karakterlerini at
function stripUnsafe(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')                 // HTML tag
    .replace(/[\x00-\x1F\x7F]/g, '')         // kontrol karakterleri (eslint-disable-line no-control-regex)
    .replace(/javascript:/gi, '')             // protocol injection
    .replace(/data:/gi, '')                   // base64 injection
    .replace(/\s+/g, ' ')                     // ardışık boşluk
    .trim();
}

/** Başlık metni: kısa, kontrol karakteri yok, max 100 */
export function sanitizeTitle(input: string): string {
  return stripUnsafe(String(input || '')).slice(0, MAX_TITLE);
}

/** Açıklama metni: orta uzunluk, max 500 */
export function sanitizeDescription(input: string): string {
  return stripUnsafe(String(input || '')).slice(0, MAX_DESC);
}

/** İsim/takma ad: max 50, sadece harf/rakam/boşluk/bazı işaretler */
export function sanitizeName(input: string): string {
  return stripUnsafe(String(input || ''))
    .replace(/[^\p{L}\p{N} \-_.']/gu, '')
    .slice(0, MAX_NAME);
}

/** Şehir: max 50, sadece harf/boşluk */
export function sanitizeCity(input: string): string {
  return stripUnsafe(String(input || ''))
    .replace(/[^\p{L} ]/gu, '')
    .slice(0, MAX_CITY);
}

/** Pozitif tam sayı (TL): 1-100000 arası */
export function sanitizeAmount(input: number | string): number {
  const n = typeof input === 'number' ? input : parseFloat(String(input).replace(/[^\d.,]/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(100000, Math.round(n)));
}

/** Aciliyet: 1, 2 veya 3 */
export function sanitizeUrgency(input: number): 1 | 2 | 3 {
  const n = Math.round(Number(input));
  if (n === 1 || n === 2 || n === 3) return n;
  return 2; // varsayılan: orta
}

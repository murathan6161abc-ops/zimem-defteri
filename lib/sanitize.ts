// Sunucuya yazılan metinlerin temizlenmesi. React ekranda zaten kaçış uygular; bu
// katman, verinin başka araçlarda (CSV, yönetim paneli) da temiz kalması için.

const MAX_TITLE = 100;
const MAX_DESC = 500;
const MAX_NAME = 50;
const MAX_CITY = 50;

// HTML etiketlerini, kontrol karakterlerini ve script/data adreslerini atar.
function stripUnsafe(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Başlık: en fazla 100 karakter */
export function sanitizeTitle(input: string): string {
  return stripUnsafe(String(input || '')).slice(0, MAX_TITLE);
}

/** Açıklama: en fazla 500 karakter */
export function sanitizeDescription(input: string): string {
  return stripUnsafe(String(input || '')).slice(0, MAX_DESC);
}

/** Takma ad / dükkan adı: en fazla 50 karakter; harf, rakam, boşluk ve - _ . ' */
export function sanitizeName(input: string): string {
  return stripUnsafe(String(input || ''))
    .replace(/[^\p{L}\p{N} \-_.']/gu, '')
    .slice(0, MAX_NAME);
}

/** Şehir / mahalle: en fazla 50 karakter; harf, boşluk ve "Fatih, İstanbul" ya da "Fatih / İstanbul" yazımı için , / . - */
export function sanitizeCity(input: string): string {
  return stripUnsafe(String(input || ''))
    .replace(/[^\p{L} ,/.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CITY);
}

/** Tutar (₺): 1 ile 100.000 arasında tam sayı */
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

// ============================================================
// Veresiye defteri okuma — ortak kurallar (bağımlılıksız)
// ────────────────────────────────────────────────────────────
// Hem uygulama (lib/ledgerScan.ts) hem de yöneticinin bilgisayarındaki tarama
// programı (scripts/scan-worker.mjs, Node'un TS desteğiyle) bu dosyayı kullanır.
// Böylece model çıktısı iki tarafta da aynı beyaz liste ile temizlenir.
// Bu dosyaya çalışma zamanında import EKLEME (yalnızca `import type`).
// ============================================================

import type { Category } from '@/types';

export interface ScannedEntry {
  ref: string; // müşteri baş harfleri ("A.Y.") — yalnızca esnafın cihazında kalır
  items: string; // alınan ürünler — kişiyi tanımlamaz
  amount: number; // TL, tam sayı
  date: string; // YYYY-MM-DD ya da ''
  category: Category;
  paid: boolean; // defterde ödenmiş/üstü çizili görünüyor
  confidence: 'high' | 'medium' | 'low';
}

export const LEDGER_CATEGORIES: Category[] = ['gida', 'egitim', 'fatura', 'saglik'];
export const MAX_LEDGER_ENTRIES = 60;

/** Model ne döndürürse döndürsün (tam ad, telefon, lakap…) yalnızca baş harfler: "M.K." */
export function toInitials(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFC')
    .split(/[\s.]+/)
    .map((word) => word.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => `${Array.from(word)[0].toLocaleUpperCase('tr-TR')}.`)
    .join('');
}

function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw);
  // "1.250,50 TL" / "85 TL" gibi metinleri de kabul et.
  const text = String(raw ?? '')
    .replace(/[^\d.,-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  return Math.round(Number(text));
}

/** Model çıktısına güvenmeyiz: her alan beyaz liste + aralık + uzunluk kontrolünden geçer. */
export function cleanEntry(raw: unknown): ScannedEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  const amount = parseAmount(e.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) return null;

  const category = LEDGER_CATEGORIES.includes(e.category as Category) ? (e.category as Category) : 'gida';
  const confidence = e.confidence === 'high' || e.confidence === 'medium' ? e.confidence : 'low';
  const items = String(e.items ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(e.date ?? '')) ? String(e.date) : '';

  return { ref: toInitials(e.ref), items, amount, date, category, paid: e.paid === true, confidence };
}

export function cleanEntries(raw: unknown): ScannedEntry[] {
  const list = raw && typeof raw === 'object' ? (raw as { entries?: unknown }).entries : undefined;
  return (Array.isArray(list) ? list : [])
    .slice(0, MAX_LEDGER_ENTRIES)
    .map(cleanEntry)
    .filter((e): e is ScannedEntry => e !== null);
}

export const LEDGER_PROMPT = `Bu fotoğraf, Türkiye'de bir esnafın (bakkal, market, fırın, kırtasiye, eczane vb.) el yazısıyla tuttuğu veresiye defterinden bir sayfadır.
Görevin: sayfadaki ÖDENMEMİŞ borçları çıkarmak ve yalnızca istenen JSON'u döndürmek.

Kurallar:
1. Her müşteri için TEK kayıt üret. Sayfada müşteri başına ara toplam / kalan borç yazıyorsa onu kullan. Yoksa o müşterinin ödenmemiş satırlarını topla.
   KISMİ ÖDEMELER: Müşterinin yanında "ödedi 50", "-50", "alındı 100", "50 verdi" gibi bir ödeme yazıyorsa bu tutarı borçtan MUTLAKA ÇIKAR. amount her zaman KALAN borçtur.
   Örnek: "un, şeker 180 TL" ve "ödedi 50" → amount = 180 - 50 = 130.
2. Üstü çizili, "ödendi", "tamam", "kapandı" yazan ya da tik (✓) ile kapatılmış borçlar için paid=true ver. Diğerleri paid=false.
3. ref: Müşterinin adını ASLA tam yazma. Yalnızca ad-soyad baş harflerini ver (ör. "Ahmet Yılmaz" → "A.Y."). Okunmuyorsa boş bırak.
4. items: Alınan ürün/hizmetleri kısaca yaz (ör. "ekmek, süt, deterjan"). Kişiyi tanımlayan hiçbir şey (isim, lakap, adres, telefon, akrabalık) YAZMA. En fazla 150 karakter. Ürün yazmıyorsa boş bırak.
5. amount: Türk lirası cinsinden kalan borç, sayı olarak. "1.250,50" → 1250.5, "85 TL" → 85.
6. date: Okunabiliyorsa son işlemin tarihi YYYY-AA-GG biçiminde, yoksa boş.
7. category: gida (bakkal, market, fırın, manav, kasap, temel ihtiyaç), egitim (kırtasiye, okul, kitap), fatura (elektrik, su, doğalgaz, telefon, internet), saglik (eczane, ilaç, sağlık). Emin değilsen gida.
8. confidence: Satırı ve rakamı net okuduysan high, kısmen okuduysan medium, tahmin ediyorsan low.
9. Fotoğraf bir veresiye/borç defteri değilse ya da okunamıyorsa entries için boş dizi ver ve warning alanına kısa bir Türkçe açıklama yaz.
Sayfada olmayan kayıt UYDURMA.`;

/** Ollama "format" alanı için JSON Schema (yapılandırılmış çıktı). */
export const LEDGER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'string' },
          items: { type: 'string' },
          amount: { type: 'number' },
          date: { type: 'string' },
          category: { type: 'string', enum: ['gida', 'egitim', 'fatura', 'saglik'] },
          paid: { type: 'boolean' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['ref', 'items', 'amount', 'category', 'paid', 'confidence'],
      },
    },
    warning: { type: 'string' },
  },
  required: ['entries'],
} as const;

// ============================================================
// Veresiye defteri okuma — ortak kurallar (bağımlılıksız)
// ────────────────────────────────────────────────────────────
// Hem uygulama (lib/ledgerScan.ts) hem de yöneticinin bilgisayarındaki tarama
// programı (scripts/ledger-reader.mjs, Node'un TS desteğiyle) bu dosyayı kullanır.
// Modele verilen komut ve satır toplama kuralları scripts/ledger-reader.mjs'te.
// Böylece model çıktısı iki tarafta da aynı beyaz liste ile temizlenir.
// Bu dosyaya çalışma zamanında import EKLEME (yalnızca `import type`).
// ============================================================

import type { Category, DebtKind } from '@/types';

export interface ScannedEntry {
  ref: string; // müşteri baş harfleri ("A.Y.") — yalnızca esnafın cihazında kalır
  items: string; // alınan ürünler — kişiyi tanımlamaz
  amount: number; // TL, tam sayı
  date: string; // YYYY-MM-DD ya da ''
  category: Category; // araştırma grubu (türden türetilir)
  kind: DebtKind; // ayrıntılı tür (bebek, temizlik, yakacak…)
  paid: boolean; // defterde ödenmiş/üstü çizili görünüyor
  confidence: 'high' | 'medium' | 'low';
  // Neden kontrol edilmeli: defterde yazan toplam satırlarla tutmuyor / rakam net okunamadı /
  // hesap defterde kapanmış (üstü çizili, "ödendi") görünüyor olabilir
  issue?: 'mismatch' | 'unclear' | 'maybe_paid' | null;
  // Hesap dökümü (yalnızca rakamlar): 70 + 60 − 50 = 80; defterde yazan toplam
  breakdown?: { debts: number[]; payments: number[]; written: number | null };
}

export const LEDGER_CATEGORIES: Category[] = ['gida', 'egitim', 'fatura', 'saglik'];

// Borç türü → araştırma grubu (veritabanı `category`). Uygulamadaki tür bilgileri
// (renk, ikon) lib/debts.ts'te; eşleme tek yerde kalsın diye burada.
export const KIND_GROUP: Record<DebtKind, Category> = {
  gida: 'gida',
  bebek: 'gida',
  temizlik: 'gida',
  saglik: 'saglik',
  egitim: 'egitim',
  giyim: 'gida',
  yakacak: 'fatura',
  fatura: 'fatura',
  ulasim: 'fatura',
  diger: 'gida',
};
export const LEDGER_KINDS = Object.keys(KIND_GROUP) as DebtKind[];
export const MAX_LEDGER_ENTRIES = 60;
const MAX_BREAKDOWN_LINES = 30;

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

export function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw);
  // "1.250,50 TL" / "85 TL" gibi metinleri de kabul et.
  const text = String(raw ?? '')
    .replace(/[^\d.,-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  return Math.round(Number(text));
}

function cleanAmounts(raw: unknown): number[] {
  return (Array.isArray(raw) ? raw : [])
    .slice(0, MAX_BREAKDOWN_LINES)
    .map(parseAmount)
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 100000);
}

function cleanBreakdown(raw: unknown): ScannedEntry['breakdown'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const b = raw as Record<string, unknown>;
  const written = b.written === null || b.written === undefined ? null : parseAmount(b.written);
  return {
    debts: cleanAmounts(b.debts),
    payments: cleanAmounts(b.payments),
    written: written !== null && Number.isFinite(written) && written >= 1 && written <= 100000 ? written : null,
  };
}

/** Model çıktısına güvenmeyiz: her alan beyaz liste + aralık + uzunluk kontrolünden geçer. */
export function cleanEntry(raw: unknown): ScannedEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  const amount = parseAmount(e.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) return null;

  // Yeni tarama programı "kind" yazar; eskisi yalnızca 4 gruptan birini ("category").
  const kind: DebtKind = LEDGER_KINDS.includes(e.kind as DebtKind)
    ? (e.kind as DebtKind)
    : LEDGER_KINDS.includes(e.category as DebtKind)
      ? (e.category as DebtKind)
      : 'gida';
  const category = KIND_GROUP[kind];
  const confidence = e.confidence === 'high' || e.confidence === 'medium' ? e.confidence : 'low';
  const items = String(e.items ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(e.date ?? '')) ? String(e.date) : '';

  const issue = e.issue === 'mismatch' || e.issue === 'unclear' || e.issue === 'maybe_paid' ? e.issue : null;
  const entry: ScannedEntry = { ref: toInitials(e.ref), items, amount, date, category, kind, paid: e.paid === true, confidence, issue };
  const breakdown = cleanBreakdown(e.breakdown);
  if (breakdown) entry.breakdown = breakdown;
  return entry;
}

export function cleanEntries(raw: unknown): ScannedEntry[] {
  const list = raw && typeof raw === 'object' ? (raw as { entries?: unknown }).entries : undefined;
  return (Array.isArray(list) ? list : [])
    .slice(0, MAX_LEDGER_ENTRIES)
    .map(cleanEntry)
    .filter((e): e is ScannedEntry => e !== null);
}

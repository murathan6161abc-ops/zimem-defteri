import type { Category, MerchantDebt } from '@/types';
import { CATEGORIES, iconOf, kindOf } from './debts';

// İstemciye gelen borç sütunları açıkça seçilir: esnafın hesap kimliği (user_id) ve
// iç bayraklar (is_sample) borç havuzunu gören herkese gönderilmez.
const BASE_COLUMNS = 'id, merchant_name, city, title, description, category, amount, urgency, closed, closed_at, created_at';
export const DEBT_COLUMNS = `${BASE_COLUMNS}, kind, icon`;
/** Tür/ikon göçü (20260928120000_debt_kind_icon.sql) çalıştırılmamış veritabanı için. */
export const DEBT_COLUMNS_LEGACY = BASE_COLUMNS;

/** Sütun henüz yok hatası mı (göç çalıştırılmamış)? */
export function isMissingColumnError(error: { message?: string; details?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const text = `${error.message ?? ''} ${error.details ?? ''}`;
  return /column/i.test(text) && /kind|icon/i.test(text);
}

/** Sorguyu tür/ikon sütunlarıyla çalıştırır; veritabanında yoksa onlarsız tekrar dener. */
export async function withDebtColumns<T extends { error: { message?: string; details?: string | null } | null }>(
  run: (columns: string) => PromiseLike<T>,
): Promise<T> {
  const first = await run(DEBT_COLUMNS);
  return isMissingColumnError(first.error) ? run(DEBT_COLUMNS_LEGACY) : first;
}

// ─── Supabase satır → MerchantDebt ─────────────────────────────
// kind/icon sütunları yoksa (eski veritabanı / eski kayıt) gruptan türetilir;
// yalnızca bilinen tür ve ikonlar gösterilir.
export function rowToDebt(row: Record<string, unknown>): MerchantDebt {
  const category = CATEGORIES.includes(row.category as Category) ? (row.category as Category) : 'gida';
  const kind = kindOf({ kind: row.kind, category });
  const urgency = Number(row.urgency);
  return {
    id: String(row.id),
    category,
    kind,
    title: String(row.title || ''),
    description: String(row.description || ''),
    amount: Number(row.amount || 0),
    urgency: urgency === 1 || urgency === 3 ? urgency : 2,
    icon: iconOf({ icon: row.icon, kind, category }),
    addedBy: String(row.merchant_name || 'Anonim Esnaf'),
    addedAt: String(row.created_at || new Date().toISOString()),
    closed: Boolean(row.closed),
    closedAt: row.closed_at ? String(row.closed_at) : undefined,
  };
}

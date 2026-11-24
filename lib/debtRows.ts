import type { Category, MerchantDebt, Verification } from '@/types';
import { CATEGORIES, iconOf, kindOf } from './debts';

// İstemciye gelen borç sütunları açıkça seçilir: esnafın hesap kimliği (user_id) ve
// iç bayraklar (is_sample) borç havuzunu gören herkese gönderilmez.
const BASE_COLUMNS = 'id, merchant_name, city, title, description, category, amount, urgency, closed, closed_at, created_at';
/** Tür/ikon göçü (20260928120000_debt_kind_icon.sql) sonrası. */
export const DEBT_COLUMNS_KIND = `${BASE_COLUMNS}, kind, icon`;
/** Muhtar doğrulaması göçü (20261124120000_muhtar_verification_direct_payment.sql) sonrası. */
export const DEBT_COLUMNS = `${DEBT_COLUMNS_KIND}, verification_status, verified_at`;
/** Hiçbir göç çalıştırılmamış veritabanı için. */
export const DEBT_COLUMNS_LEGACY = BASE_COLUMNS;
/** Yeniden eskiye: sütun eksikse bir sonraki denenir. */
export const DEBT_COLUMN_TIERS = [DEBT_COLUMNS, DEBT_COLUMNS_KIND, DEBT_COLUMNS_LEGACY] as const;

/** Sütun henüz yok hatası mı (göç çalıştırılmamış)? */
export function isMissingColumnError(error: { message?: string; details?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const text = `${error.message ?? ''} ${error.details ?? ''}`;
  return /column/i.test(text) && /kind|icon|verification_status|verified_at/i.test(text);
}

/** Sorguyu en yeni sütunlarla çalıştırır; veritabanında yoksa daha eski sütun setiyle tekrar dener. */
export async function withDebtColumns<T extends { error: { message?: string; details?: string | null } | null }>(
  run: (columns: string) => PromiseLike<T>,
): Promise<T> {
  let result = await run(DEBT_COLUMN_TIERS[0]);
  for (const columns of DEBT_COLUMN_TIERS.slice(1)) {
    if (!isMissingColumnError(result.error)) break;
    result = await run(columns);
  }
  return result;
}

const VERIFICATIONS: readonly Verification[] = ['pending', 'verified', 'rejected'];

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
    verification: VERIFICATIONS.includes(row.verification_status as Verification)
      ? (row.verification_status as Verification)
      : undefined,
    verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
  };
}

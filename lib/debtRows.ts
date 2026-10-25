import type { Category, MerchantDebt } from '@/types';
import { CATEGORIES } from './debts';

export const DEBT_COLUMNS =
  'id, merchant_name, city, title, description, category, amount, urgency, closed, closed_at, created_at';

/** merchant_debts satırını uygulamadaki borç nesnesine çevirir. */
export function rowToDebt(row: Record<string, unknown>): MerchantDebt {
  const category = CATEGORIES.includes(row.category as Category) ? (row.category as Category) : 'gida';
  const urgency = Number(row.urgency);
  return {
    id: String(row.id),
    category,
    title: String(row.title || ''),
    description: String(row.description || ''),
    amount: Number(row.amount || 0),
    urgency: urgency === 1 || urgency === 3 ? urgency : 2,
    addedBy: String(row.merchant_name || 'Anonim Esnaf'),
    addedAt: String(row.created_at || new Date().toISOString()),
    closed: Boolean(row.closed),
    closedAt: row.closed_at ? String(row.closed_at) : undefined,
  };
}

// merchant_debts ortak borç havuzudur: esnaf ekler, vatandaş kapatır, açık olanlar
// listede görünür ve değişiklikler Realtime ile diğer cihazlara gider. Örnek borçlar
// veritabanı göçüyle eklenir.

import { getSupabase } from './supabase';
import { getCurrentUserId } from './auth';
import {
  sanitizeTitle,
  sanitizeDescription,
  sanitizeAmount,
  sanitizeUrgency,
  sanitizeName,
  sanitizeCity,
} from './sanitize';
import type { Category, DebtKind, MerchantDebt } from '@/types';
import { CATEGORIES, iconOf, isDebtKind, KIND_META, MAX_DEBT_AMOUNT } from './debts';
import { DEBT_COLUMNS, DEBT_COLUMNS_LEGACY, isMissingColumnError, rowToDebt, withDebtColumns } from './debtRows';

export { rowToDebt };

// ─── Açık borçları çek (closed=false) ────────────────────────
export async function fetchOpenDebts(): Promise<MerchantDebt[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await withDebtColumns((columns) =>
    client
      .from('merchant_debts')
      .select(columns)
      .eq('closed', false)
      .order('urgency', { ascending: false })
      .order('created_at', { ascending: false }),
  );

  if (error) {
    console.warn('[supabaseDebts] fetchOpenDebts hatası:', error.message);
    return [];
  }
  return ((data || []) as unknown as Record<string, unknown>[]).map(rowToDebt);
}

export interface MerchantPaymentResult {
  id: string;
  paidAmount: number;
  newAmount: number;
  closed: boolean;
  closedAt: string | null;
}

/** Borç bakiyesini sunucuda atomik olarak azaltır. */
export async function payMerchantDebtRemote(
  id: string,
  requestedAmount: number,
): Promise<MerchantPaymentResult | null> {
  const client = getSupabase();
  if (!client || !id || requestedAmount <= 0) return null;

  const { data, error } = await client.rpc('pay_merchant_debt', {
    p_debt_id: id,
    p_requested_amount: sanitizeAmount(requestedAmount),
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return {
    id: String(row.id),
    paidAmount: Number(row.paid_amount),
    newAmount: Number(row.new_amount),
    closed: Boolean(row.closed),
    closedAt: row.closed_at ? String(row.closed_at) : null,
  };
}

// Metinler sunucuya yazılmadan önce temizlenir.
export async function insertMerchantDebt(args: {
  title: string;
  description: string;
  category: Category;
  kind?: DebtKind;
  icon?: string;
  amount: number;
  urgency: 1 | 2 | 3;
  merchantName?: string;
  city?: string;
}): Promise<MerchantDebt | null> {
  const client = getSupabase();
  if (!client) return null;

  const title = sanitizeTitle(args.title);
  const description = sanitizeDescription(args.description);
  const amount = sanitizeAmount(args.amount);
  const urgency = sanitizeUrgency(args.urgency);
  // Temizlik sonrası boş ya da çok kısa kalan ad/şehir, veritabanı kuralına takılıp
  // borcun hiç kaydedilmemesine yol açmasın: bu durumda alan boş bırakılır.
  const merchantName = sanitizeName(args.merchantName ?? '');
  const city = sanitizeCity(args.city ?? '');

  // Tür ve grup whitelist kontrolü: grup her zaman türden türetilir (tutarlı kalsın).
  const kind = isDebtKind(args.kind) ? args.kind : null;
  const category = kind ? KIND_META[kind].group : args.category;
  if (!CATEGORIES.includes(category)) {
    console.warn('[supabaseDebts] Geçersiz kategori:', args.category);
    return null;
  }
  const icon = kind ? iconOf({ icon: args.icon, kind, category }) : null;

  // Minimum doğrulama. Aralık dışı tutar kırpılmaz, reddedilir: esnaf yazdığından
  // farklı bir borç kaydedilmesin.
  const amountInRange = Number.isInteger(args.amount) && args.amount >= 1 && args.amount <= MAX_DEBT_AMOUNT;
  if (title.length < 3 || description.length < 3 || !amountInRange) {
    console.warn('[supabaseDebts] Geçersiz borç verisi');
    return null;
  }

  const base = {
    user_id: getCurrentUserId(),
    merchant_name: merchantName.length >= 2 ? merchantName : null,
    city: city || null,
    title,
    description,
    category,
    amount,
    urgency,
    closed: false,
    is_sample: false,
  };
  const insert = (row: Record<string, unknown>, columns: string) =>
    client.from('merchant_debts').insert(row).select(columns).single();

  let { data, error } = await insert(kind ? { ...base, kind, icon } : base, DEBT_COLUMNS);
  // Tür/ikon sütunları henüz eklenmemişse (SQL çalıştırılmadıysa) onlarsız kaydet.
  if (isMissingColumnError(error)) {
    ({ data, error } = await insert(base, DEBT_COLUMNS_LEGACY));
  }

  if (error) {
    console.warn('[supabaseDebts] insertMerchantDebt hatası:', error.message);
    return null;
  }
  // Sunucu tür/ikonu saklamasa da bu cihazda seçilen görünsün.
  const debt = rowToDebt(data as unknown as Record<string, unknown>);
  return kind ? { ...debt, kind, icon: icon ?? debt.icon } : debt;
}

/** Esnafın kendi açık borcunu sunucudan siler. RLS başka birinin ya da kapanmış
 *  borcu silmeye izin vermez → 0 satır döner ve false olur. */
export async function deleteMerchantDebt(id: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { data, error } = await client.from('merchant_debts').delete().eq('id', id).select('id');
    if (error) {
      console.warn('[supabaseDebts] deleteMerchantDebt hatası:', error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Esnafın kendi defteri (eklediği tüm borçlar). Hata olursa null: eldeki defter silinmesin. */
export async function fetchMyMerchantDebts(userId: string): Promise<MerchantDebt[] | null> {
  const client = getSupabase();
  if (!client || !userId) return null;

  const { data, error } = await withDebtColumns((columns) =>
    client
      .from('merchant_debts')
      .select(columns)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );

  if (error) {
    console.warn('[supabaseDebts] fetchMyMerchantDebts hatası:', error.message);
    return null;
  }
  return ((data || []) as unknown as Record<string, unknown>[]).map(rowToDebt);
}

/** Esnafın kendi borçlarındaki değişiklikleri (hayırseverin ödemesi, kapanma) dinler. */
export function subscribeToMyDebts(userId: string, onChange: (debt: MerchantDebt) => void): () => void {
  const client = getSupabase();
  if (!client || !userId) return () => {};

  const filter = `user_id=eq.${userId}`;
  // Kanal adı "merchant_debts" içermez: subscribeToDebts'in kanal temizliği bunu kapatmasın.
  const channel = client
    .channel(`my_debts_${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'merchant_debts', filter },
      (payload) => onChange(rowToDebt(payload.new as Record<string, unknown>)),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'merchant_debts', filter },
      (payload) => onChange(rowToDebt(payload.new as Record<string, unknown>)),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToDebts(handlers: {
  onInsert?: (debt: MerchantDebt) => void;
  onUpdate?: (debt: MerchantDebt) => void;
  // Borç ödenerek kapandı (bakiye sıfırlandı).
  onClose?: (id: string) => void;
  // Esnaf borcu sildi.
  onDelete?: (id: string) => void;
}): () => void {
  const client = getSupabase();
  if (!client) return () => {};

  // Remount / HMR / sayfa dönüşü sonrası kalan aynı tablo kanallarını temizle.
  // Aksi halde Supabase aynı isimli, zaten subscribe edilmiş kanalı döndürür ve
  // üzerine .on() eklenince "cannot add postgres_changes callbacks ... after
  // subscribe()" hatası fırlar → realtime sessizce kırılır.
  for (const existing of client.getChannels()) {
    if (existing.topic.includes('merchant_debts')) {
      void client.removeChannel(existing);
    }
  }

  // Benzersiz kanal ismi → isim çakışması imkânsız (yukarıdaki temizlikle çift güvence).
  const channel = client
    .channel(`merchant_debts_${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'merchant_debts' },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row?.closed) return;
        handlers.onInsert?.(rowToDebt(row));
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'merchant_debts' },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row?.closed) {
          handlers.onClose?.(String(row.id));
        } else {
          handlers.onUpdate?.(rowToDebt(row));
        }
      },
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'merchant_debts' },
      (payload) => {
        const row = payload.old as Record<string, unknown>;
        if (row?.id) handlers.onDelete?.(String(row.id));
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

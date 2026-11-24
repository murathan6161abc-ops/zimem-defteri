// Gerçek ödeme: PARA UYGULAMADAN GEÇMEZ. Vatandaş muhtar onaylı bir borcu üstlenir
// (ödeme taahhüdü), bir ödeme kodu alır ve parayı dükkânda ya da esnafın IBAN'ına
// doğrudan öder. Borç, esnaf "parayı aldım" deyince sunucuda azalır/kapanır.
// Kurallar veritabanında (20261124120000_muhtar_verification_direct_payment.sql).

import { getSupabase, isSupabaseConfigured } from './supabase';
import type { Verification } from '@/types';

export type PledgeMethod = 'dukkan' | 'havale';
export type PledgeStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export interface Pledge {
  id: string;
  debtId: string;
  amount: number;
  code: string;
  method: PledgeMethod;
  status: PledgeStatus;
  createdAt: string;
  // Ödeyen "Parayı gönderdim" dediyse (yalnızca havale): artık iptal edilemez.
  sentAt?: string;
  resolvedAt?: string;
  debtTitle?: string;
  merchantName?: string;
  city?: string;
  // Yalnızca havalede ve taahhüt sahibine gösterilir.
  iban?: string;
  accountHolder?: string;
}

export interface PaymentInfo {
  iban: string;
  accountHolder: string;
}

// ─── IBAN ───────────────────────────────────────────────────────────────────
/** Boşlukları atar, büyük harfe çevirir. */
export function normalizeIban(text: string): string {
  return text.replace(/\s+/g, '').toUpperCase();
}

/** Türk IBAN'ı mı: TR + 24 rakam ve ISO 13616 mod-97 kontrolü. */
export function isValidTrIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^TR\d{24}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

/** "TR33 0006 1005 …" biçiminde gösterim. */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, '$1 ').trim();
}

// ─── Sunucu hata kodları → arayüz nedeni ────────────────────────────────────
export type PledgeFailure =
  | 'adult_only'
  | 'not_payable'
  | 'own_debt'
  | 'no_iban'
  | 'too_many_pending'
  | 'exceeds'
  | 'unavailable'
  | 'error';

export function pledgeFailureFrom(message: string | undefined): { reason: PledgeFailure; available?: number } {
  const text = message ?? '';
  const exceeds = /amount_exceeds_available:(\d+)/.exec(text);
  if (exceeds) return { reason: 'exceeds', available: Number(exceeds[1]) };
  for (const reason of ['adult_only', 'not_payable', 'own_debt', 'no_iban', 'too_many_pending'] as const) {
    if (text.includes(reason)) return { reason };
  }
  // Göç çalıştırılmamış: fonksiyon yok.
  if (/create_debt_pledge|function .* does not exist|PGRST202/i.test(text)) return { reason: 'unavailable' };
  return { reason: 'error' };
}

/** Tablo ya da fonksiyon yok (göç çalıştırılmamış) mı? */
function isMissingFeature(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST202' ||
    /does not exist|could not find/i.test(error.message ?? '')
  );
}

const PLEDGE_STATUSES: readonly PledgeStatus[] = ['pending', 'confirmed', 'rejected', 'cancelled'];

export function rowToPledge(row: Record<string, unknown>): Pledge {
  const debt = (row.merchant_debts ?? {}) as Record<string, unknown>;
  const status = PLEDGE_STATUSES.includes(row.status as PledgeStatus) ? (row.status as PledgeStatus) : 'pending';
  return {
    id: String(row.id),
    debtId: String(row.debt_id ?? ''),
    amount: Number(row.amount || 0),
    code: String(row.code || ''),
    method: row.method === 'havale' ? 'havale' : 'dukkan',
    status,
    createdAt: String(row.created_at || new Date().toISOString()),
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
    debtTitle: debt.title ? String(debt.title) : undefined,
    merchantName: (row.merchant_name ?? debt.merchant_name) ? String(row.merchant_name ?? debt.merchant_name) : undefined,
    city: (row.city ?? debt.city) ? String(row.city ?? debt.city) : undefined,
    iban: row.iban ? String(row.iban) : undefined,
    accountHolder: row.account_holder ? String(row.account_holder) : undefined,
  };
}

const PLEDGE_COLUMNS = 'id, debt_id, amount, code, method, status, created_at, sent_at, resolved_at';

// ─── Vatandaş ───────────────────────────────────────────────────────────────
export type CreatePledgeResult =
  | { ok: true; pledge: Pledge }
  | { ok: false; reason: PledgeFailure; available?: number };

/** Çevrimdışı demoda sunucu yok: kod bu cihazda üretilir, gerçek ödeme yapılmaz. */
function demoPledge(debt: { id: string; title: string }, amount: number): Pledge {
  const code = `DZ-${Math.random().toString(16).slice(2, 8).toUpperCase().padEnd(6, '0')}`;
  return {
    id: `demo-${Date.now()}`,
    debtId: debt.id,
    amount,
    code,
    method: 'dukkan',
    status: 'pending',
    createdAt: new Date().toISOString(),
    debtTitle: debt.title,
  };
}

export async function createPledge(
  debt: { id: string; title: string },
  amount: number,
  method: PledgeMethod,
): Promise<CreatePledgeResult> {
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, reason: 'error' };
  if (!isSupabaseConfigured()) {
    return method === 'havale' ? { ok: false, reason: 'no_iban' } : { ok: true, pledge: demoPledge(debt, amount) };
  }
  const client = getSupabase();
  if (!client) return { ok: false, reason: 'error' };

  const { data, error } = await client.rpc('create_debt_pledge', {
    p_debt_id: debt.id,
    p_amount: amount,
    p_method: method,
  });
  if (error) return { ok: false, ...pledgeFailureFrom(`${error.message} ${error.code ?? ''}`) };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { ok: false, reason: 'error' };
  return { ok: true, pledge: { ...rowToPledge({ ...row, debt_id: debt.id }), debtTitle: debt.title } };
}

/** Bu hesabın taahhütleri (en yeni önce). Özellik yoksa ya da hata olursa null. */
export async function fetchMyPledges(userId: string): Promise<Pledge[] | null> {
  const client = getSupabase();
  if (!client || !userId) return null;
  const { data, error } = await client
    .from('debt_pledges')
    .select(`${PLEDGE_COLUMNS}, merchant_debts(title, merchant_name, city)`)
    .eq('payer_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    if (!isMissingFeature(error)) console.warn('[pledges] fetchMyPledges hatası:', error.message);
    return null;
  }
  return ((data || []) as unknown as Record<string, unknown>[]).map(rowToPledge);
}

/** Havale bilgisini yeniden göster (yalnızca kendi bekleyen havale taahhüdü için). */
export async function fetchPledgePaymentDetails(pledgeId: string): Promise<PaymentInfo | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('pledge_payment_details', { p_pledge_id: pledgeId });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return null;
  return { iban: String(row.iban), accountHolder: String(row.account_holder) };
}

export async function cancelPledge(pledgeId: string): Promise<boolean> {
  if (pledgeId.startsWith('demo-')) return true;
  const client = getSupabase();
  if (!client) return false;
  const { data, error } = await client.rpc('cancel_debt_pledge', { p_pledge_id: pledgeId });
  return !error && data === true;
}

/** Havale yapan "Parayı gönderdim" der; işaretlenen anı döner, olmazsa null. */
export async function markPledgeSent(pledgeId: string): Promise<string | null> {
  if (pledgeId.startsWith('demo-')) return new Date().toISOString();
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('mark_pledge_sent', { p_pledge_id: pledgeId });
  return !error && data ? String(data) : null;
}

/** Kaç tam gündür bekliyor (esnaf hatırlatması ve yönetici takibi için). */
export function daysWaiting(pledge: Pick<Pledge, 'createdAt' | 'sentAt'>, now = Date.now()): number {
  const since = Date.parse(pledge.sentAt ?? pledge.createdAt);
  return Number.isFinite(since) ? Math.max(0, Math.floor((now - since) / 86_400_000)) : 0;
}

// ─── Esnaf ──────────────────────────────────────────────────────────────────
/** Esnafın borçlarına gelen taahhütler. Özellik yoksa (göç çalıştırılmamış) null. */
export async function fetchIncomingPledges(userId: string): Promise<Pledge[] | null> {
  const client = getSupabase();
  if (!client || !userId) return null;
  const { data, error } = await client
    .from('debt_pledges')
    .select(`${PLEDGE_COLUMNS}, merchant_debts!inner(title, user_id)`)
    .eq('merchant_debts.user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    if (!isMissingFeature(error)) console.warn('[pledges] fetchIncomingPledges hatası:', error.message);
    return null;
  }
  return ((data || []) as unknown as Record<string, unknown>[]).map(rowToPledge);
}

export interface ResolveResult {
  status: PledgeStatus;
  debtId: string;
  paidAmount: number;
  newAmount: number;
  closed: boolean;
}

/** Esnaf: parayı aldı (true) ya da almadı (false). Taahhüt artık beklemiyorsa null. */
export async function resolvePledge(pledgeId: string, received: boolean): Promise<ResolveResult | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('resolve_debt_pledge', { p_pledge_id: pledgeId, p_received: received });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    status: PLEDGE_STATUSES.includes(row.pledge_status) ? row.pledge_status : 'pending',
    debtId: String(row.debt_id),
    paidAmount: Number(row.paid_amount),
    newAmount: Number(row.new_amount),
    closed: Boolean(row.closed),
  };
}

/** Taahhüt tablosundaki değişiklikleri dinler (RLS: yalnızca ilgili kayıtlar gelir). */
export function subscribeToPledges(onChange: () => void): () => void {
  const client = getSupabase();
  if (!client) return () => {};
  const channel = client
    .channel(`debt_pledges_${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'debt_pledges' }, () => onChange())
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

/** Esnafın havale bilgisi. `available: false` → göç çalıştırılmamış, bölüm gizlenir. */
export async function fetchMyPaymentInfo(): Promise<{ available: boolean; info: PaymentInfo | null }> {
  const client = getSupabase();
  if (!client) return { available: false, info: null };
  const { data, error } = await client.from('merchant_payment_info').select('iban, account_holder').maybeSingle();
  if (error) return { available: !isMissingFeature(error), info: null };
  return {
    available: true,
    info: data ? { iban: String(data.iban), accountHolder: String(data.account_holder) } : null,
  };
}

export async function saveMyPaymentInfo(userId: string, info: PaymentInfo): Promise<boolean> {
  const client = getSupabase();
  const iban = normalizeIban(info.iban);
  const accountHolder = info.accountHolder.trim().replace(/\s+/g, ' ');
  if (!client || !userId || !isValidTrIban(iban) || accountHolder.length < 2 || accountHolder.length > 80) return false;
  const { error } = await client
    .from('merchant_payment_info')
    .upsert({ user_id: userId, iban, account_holder: accountHolder, updated_at: new Date().toISOString() });
  if (error) console.warn('[pledges] saveMyPaymentInfo hatası:', error.message);
  return !error;
}

export async function deleteMyPaymentInfo(userId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client || !userId) return false;
  const { error } = await client.from('merchant_payment_info').delete().eq('user_id', userId);
  return !error;
}

// ─── Yönetici: takılan ödemeler ─────────────────────────────────────────────
export const STUCK_AFTER_DAYS = 3;

/** Takip edilecek ödemeler: 3 günden uzun süredir bekleyenler ve son 30 günde esnafın
 *  "almadım" dedikleri. */
export function isStuckPledge(pledge: Pledge, now = Date.now()): boolean {
  if (pledge.status === 'pending') return daysWaiting(pledge, now) >= STUCK_AFTER_DAYS;
  if (pledge.status === 'rejected') {
    const resolved = Date.parse(pledge.resolvedAt ?? '');
    return Number.isFinite(resolved) && now - resolved < 30 * 86_400_000;
  }
  return false;
}

/** Yönetici tüm ödeme kayıtlarını görebilir (RLS). Özellik yoksa null. */
export async function fetchStuckPledges(): Promise<Pledge[] | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from('debt_pledges')
    .select(`${PLEDGE_COLUMNS}, merchant_debts(title, merchant_name, city)`)
    .in('status', ['pending', 'rejected'])
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) {
    if (!isMissingFeature(error)) console.warn('[pledges] fetchStuckPledges hatası:', error.message);
    return null;
  }
  const now = Date.now();
  return ((data || []) as unknown as Record<string, unknown>[]).map(rowToPledge).filter((p) => isStuckPledge(p, now));
}

// ─── Yönetici: muhtar doğrulaması ──────────────────────────────────────────
export interface QueueDebt {
  id: string;
  title: string;
  description: string;
  merchantName: string;
  city: string;
  amount: number;
  createdAt: string;
  verification: Verification;
  reference?: string;
  decidedAt?: string;
}

/** Açık, örnek olmayan borçlar ve muhtar kayıtları. Özellik yoksa null. */
export async function fetchVerificationQueue(): Promise<QueueDebt[] | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from('merchant_debts')
    .select('id, title, description, merchant_name, city, amount, created_at, verification_status')
    .eq('closed', false)
    .eq('is_sample', false)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) {
    if (!/verification_status/.test(error.message)) console.warn('[pledges] fetchVerificationQueue hatası:', error.message);
    return null;
  }
  const refs = new Map<string, { reference: string; decidedAt: string }>();
  const { data: refRows } = await client.rpc('list_debt_verifications');
  if (Array.isArray(refRows)) {
    for (const r of refRows) refs.set(String(r.debt_id), { reference: String(r.reference), decidedAt: String(r.decided_at) });
  }
  return ((data || []) as Record<string, unknown>[]).map((row) => {
    const ref = refs.get(String(row.id));
    const status = row.verification_status as Verification;
    return {
      id: String(row.id),
      title: String(row.title || ''),
      description: String(row.description || ''),
      merchantName: String(row.merchant_name || 'Anonim Esnaf'),
      city: String(row.city || ''),
      amount: Number(row.amount || 0),
      createdAt: String(row.created_at),
      verification: status === 'verified' || status === 'rejected' ? status : 'pending',
      reference: ref?.reference,
      decidedAt: ref?.decidedAt,
    };
  });
}

export async function setDebtVerification(
  debtId: string,
  status: Verification,
  reference: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'Sunucu yok' };
  const { data, error } = await client.rpc('set_debt_verification', {
    p_debt_id: debtId,
    p_status: status,
    p_reference: reference.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: Array.isArray(data) && data.length > 0 };
}

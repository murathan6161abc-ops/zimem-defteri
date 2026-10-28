// ============================================================
// Kullanıcı adı + şifre ile hesap sistemi (Supabase Auth)
// ────────────────────────────────────────────────────────────
// Supabase Auth e-posta ister; biz kullanıcı adını sentetik bir
// e-posta diğer adına çeviririz:  kullanici  →  kullanici@dzimem.app
// Böylece kullanıcı yalnızca "kullanıcı adı + şifre" girer.
//
// ÖNEMLİ (tek seferlik kurulum): Supabase panelinde
//   Authentication → Providers → Email → "Confirm email" KAPALI olmalı.
// Aksi halde sentetik e-postaya doğrulama linki gider ve hesap açılmaz.
//
// Kimlik: giriş yapan kullanıcının auth.uid()'i artık tüm verilerde
// (anket, snapshot, esnaf borçları) user_id kolonuna yazılan sabit
// kimliktir. Böylece aynı tarayıcıyı paylaşan kişilerin verileri
// birbirine karışmaz.
// ============================================================

import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { getDeviceId } from './deviceId';
import { isAgeGroup } from './research';
import { clearLedgerRefs } from './ledgerScan';
import { rowToDebt } from './supabaseDebts';
import type {
  Category,
  HistoryEntry,
  MerchantDebt,
  Role,
  UserProfile,
} from '@/types';

const USERNAME_DOMAIN = 'dzimem.app';
const USER_ID_KEY = 'd-zimem-user-id';
// Kalıcı hesap kimliği: kayıt/giriş başarısında yazılır, YALNIZCA explicit
// çıkışta (signOut) silinir. AuthGate, oturum bootstrap'ı sırasında getSession()
// geçici olarak null döndürdüğünde USER_ID_KEY'i siliyor ve kimlik cihaz id'sine
// düşüyordu (kayıt sonrası ilk işlem cihaza yazılıp girişte "XP 0" oluyordu).
// Bu anahtar o yarıştan etkilenmez.
const ACCOUNT_ID_KEY = 'd-zimem-account-id';

// ─── Kullanıcı adı ↔ sentetik e-posta ────────────────────────
export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

export function isValidUsername(u: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(normalizeUsername(u));
}

export function isValidPassword(p: string): boolean {
  return typeof p === 'string' && p.length >= 10;
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string | undefined | null): string {
  if (!email) return '';
  return email.split('@')[0] || '';
}

/** Kayıtta üretilen kullanıcı-adı@dzimem.app biçimindeki sentetik e-posta mı? */
export function isSyntheticEmail(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${USERNAME_DOMAIN}`);
}

/** Giriş alanı: "@" içeriyorsa gerçek e-posta, değilse kullanıcı adı. */
export function identifierToEmail(identifier: string): string {
  const v = identifier.trim().toLowerCase();
  return v.includes('@') ? v : usernameToEmail(v);
}

// ─── Senkron kimlik önbelleği ────────────────────────────────
// Store aksiyonları (borç kapatma) senkron çalışır; auth.uid()'i
// her seferinde async almak yerine önbellekten okuruz.
let cachedUserId: string | null = null;

export function setAuthCache(id: string | null): void {
  cachedUserId = id;
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      window.localStorage.setItem(USER_ID_KEY, id);
      // Kalıcı kimlik de yaz; bunu yalnızca signOut() temizler.
      window.localStorage.setItem(ACCOUNT_ID_KEY, id);
    } else {
      window.localStorage.removeItem(USER_ID_KEY);
      // ACCOUNT_ID_KEY'i BİLEREK silmiyoruz — geçici null'lar kimliği silmesin.
    }
  } catch {}
}

/**
 * Kalıcı Supabase oturumundan (sb-<ref>-auth-token) auth uid'i SENKRON okur.
 * Cache veya USER_ID_KEY herhangi bir nedenle kaçırılmış olsa bile, açık bir
 * oturum varken verileri cihaz kimliğine düşürmemek için güvence katmanı.
 */
function readAuthUidFromSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const raw = ls.getItem(k);
        if (!raw) continue;
        const v = JSON.parse(raw);
        const uid = v?.user?.id || v?.currentSession?.user?.id;
        if (uid) return String(uid);
      }
    }
  } catch {}
  return null;
}

/**
 * Geçerli kimliği senkron döndürür:
 *   1. Bellekteki oturum kullanıcısı
 *   2. localStorage'daki son kullanıcı (yeniden yükleme sonrası)
 *   3. Kalıcı Supabase oturumundaki auth uid (cache kaçırılmışsa bile hesaba bağla)
 *   4. Fallback: cihaz kimliği (Supabase yapılandırılmamışsa / çıkışta)
 */
export function getCurrentUserId(): string {
  if (cachedUserId) return cachedUserId;
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(USER_ID_KEY);
      if (stored) return stored;
    } catch {}
    // Oturum açıkken verileri DAİMA auth uid'e bağla — cihaz kimliğine düşme.
    // (Aksi halde kayıt sonrası ilk işlem cihaz kimliğiyle yazılıp girişte
    //  "ilerleme/XP kayboldu" sorununa yol açıyordu.)
    const sessionUid = readAuthUidFromSession();
    if (sessionUid) {
      cachedUserId = sessionUid;
      try {
        window.localStorage.setItem(USER_ID_KEY, sessionUid);
      } catch {}
      return sessionUid;
    }
    // Kalıcı hesap kimliği — kayıt/giriş'te yazılır, yalnızca çıkışta silinir.
    // (Kayıt sonrası AuthGate cache'i geçici silse bile kimlik hesaba bağlı kalır.)
    try {
      const acct = window.localStorage.getItem(ACCOUNT_ID_KEY);
      if (acct) {
        cachedUserId = acct;
        return acct;
      }
    } catch {}
  }
  return getDeviceId();
}

// ─── Profil ↔ auth metadata ──────────────────────────────────
export function profileFromMetadata(user: User): UserProfile {
  const m = (user.user_metadata || {}) as Record<string, unknown>;
  const role = (m.role === 'esnaf' ? 'esnaf' : 'vatandas') as Role;
  // Girişte kullanılan kimlik:
  //  - eski hesap (kullanıcı adıyla açılmış): sentetik e-postadaki kullanıcı adı;
  //    sonradan kurtarma e-postası eklediyse metadata'daki kullanıcı adı
  //  - yeni hesap (e-posta + kodla açılmış): e-posta adresi
  const metaUsername = typeof m.username === 'string' && isValidUsername(m.username) ? m.username : '';
  const username = isSyntheticEmail(user.email) ? emailToUsername(user.email) : metaUsername || user.email || '';
  return {
    username,
    role,
    displayName: String(m.displayName || username || ''),
    shopName: m.shopName ? String(m.shopName) : undefined,
    city: m.city ? String(m.city) : undefined,
    createdAt: String(m.createdAt || user.created_at || new Date().toISOString()),
    consentAt: m.consentAt ? String(m.consentAt) : undefined,
    ageGroup: isAgeGroup(m.ageGroup) ? m.ageGroup : undefined,
    guardianConsentAt: m.guardianConsentAt ? String(m.guardianConsentAt) : undefined,
  };
}

/** Authorization must use server-managed app_metadata, never user_metadata. */
export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const metadata = (user.app_metadata || {}) as Record<string, unknown>;
  return metadata.role === 'admin';
}

// ─── Hata eşleme (kullanıcıya gösterilecek i18n anahtarı) ─────
export type AuthErrorCode =
  | 'not_configured'
  | 'invalid_username'
  | 'weak_password'
  | 'username_taken'
  | 'invalid_credentials'
  | 'confirm_off_required'
  | 'network'
  | 'too_many_attempts'
  | 'generic';

function mapError(message: string | undefined): AuthErrorCode {
  const msg = (message || '').toLowerCase();
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'username_taken';
  }
  if (msg.includes('invalid login credentials')) return 'invalid_credentials';
  // Kullanıcı adı başka bir hesaba ayrılmış (kurtarma e-postasına geçmiş hesap):
  // auth.users tetikleyicisi kaydı reddeder, GoTrue bunu genel DB hatası olarak döndürür.
  if (msg.includes('database error saving new user')) return 'username_taken';
  // Ağ/DNS hatası: proje duraklatılmış, internet yok veya CSP bağlantıyı engelliyor.
  // Muğlak "bir şeyler ters gitti" yerine kullanıcıya gerçek nedeni göster.
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('fetch failed') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound')
  ) {
    return 'network';
  }
  // "email_address_invalid" (DNS kontrolü) ve "rate limit" yalnızca Supabase'de
  // "Confirm email" AÇIKKEN oluşur — sentetik e-posta hep geçerli biçimdedir.
  // İkisi de aynı çözümü işaret eder: panelde e-posta doğrulamasını kapat.
  if (msg.includes('is invalid') || msg.includes('email address') || msg.includes('rate limit')) {
    return 'confirm_off_required';
  }
  if (msg.includes('password')) return 'weak_password';
  return 'generic';
}

export interface AuthResult {
  ok: boolean;
  error?: AuthErrorCode;
  user?: User;
}

/** Hata kodunu i18n anahtarına çevirir (login/register ortak). */
export function authErrorKey(code?: AuthErrorCode): string {
  switch (code) {
    case 'invalid_username':
      return 'auth.err_invalid_username';
    case 'weak_password':
      return 'auth.err_weak_password';
    case 'username_taken':
      return 'auth.err_username_taken';
    case 'invalid_credentials':
      return 'auth.err_invalid_credentials';
    case 'confirm_off_required':
      return 'auth.err_confirm_off';
    case 'network':
      return 'auth.err_network';
    case 'too_many_attempts':
      return 'auth.err_too_many_attempts';
    case 'not_configured':
      return 'auth.err_not_configured';
    default:
      return 'auth.err_generic';
  }
}

// ─── Kayıt ───────────────────────────────────────────────────
// Yeni hesaplar e-posta + 6 haneli kodla açılır: bkz. lib/accountSecurity.ts
// (startEmailSignUp / verifySignUpCode / finishEmailSignUp).

// ─── Giriş ───────────────────────────────────────────────────
// identifier: kullanıcı adı ya da (kurtarma e-postası eklemiş hesaplar için) e-posta.
export async function signIn(identifier: string, password: string): Promise<AuthResult> {
  if (!identifier.trim() || !password) return { ok: false, error: 'invalid_credentials' };

  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };

  const finish = (user: User | null | undefined): AuthResult => {
    setAuthCache(user?.id ?? null);
    return { ok: true, user: user ?? undefined };
  };

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: identifierToEmail(identifier),
      password,
    });
    if (!error) return finish(data.user);

    const code = mapError(error.message);
    // Kullanıcı adı yazıldı ama hesap kurtarma e-postasına geçmiş olabilir:
    // sunucu, ŞİFRE DOĞRUYSA o kullanıcı adının e-postasını döndürür (yanlışsa
    // hiçbir şey döndürmez; deneme sayısı sınırlıdır). Bkz. resolve_login_email.
    if (code !== 'invalid_credentials' || identifier.includes('@')) return { ok: false, error: code };

    const resolved = await client.rpc('resolve_login_email', {
      p_username: normalizeUsername(identifier),
      p_password: password,
    });
    if (resolved.error) {
      const tooMany = resolved.error.code === 'PT429' || resolved.status === 429;
      // Fonksiyon henüz kurulmamışsa (eski sunucu) normal "hatalı" mesajına düş.
      return { ok: false, error: tooMany ? 'too_many_attempts' : 'invalid_credentials' };
    }
    if (typeof resolved.data !== 'string' || !resolved.data) return { ok: false, error: 'invalid_credentials' };

    const second = await client.auth.signInWithPassword({ email: resolved.data, password });
    if (second.error) return { ok: false, error: mapError(second.error.message) };
    return finish(second.data.user);
  } catch (e) {
    return { ok: false, error: mapError(e instanceof Error ? e.message : String(e)) };
  }
}

// ─── Çıkış ───────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (client) {
    try {
      await client.auth.signOut();
    } catch {}
  }
  setAuthCache(null);
  // Kalıcı hesap kimliğini YALNIZCA burada (explicit çıkışta) temizle.
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(ACCOUNT_ID_KEY);
    } catch {}
  }
  // Paylaşılan cihazda bir sonraki kişi müşteri baş harflerini görmesin.
  clearLedgerRefs();
}

// ─── Hesap verilerini sunucudan yükle (giriş / yeni cihaz) ────
export interface AccountData {
  xp: number;
  debtsPaid: number;
  totalDonated: number;
  streak: number;
  lastActionDate: string | null;
  history: HistoryEntry[];
  merchantDebts: MerchantDebt[];
}

/** Esnafın sunucudaki kendi borçları (en yeni önce). Okunamazsa null. */
export async function fetchMyMerchantDebts(userId: string): Promise<MerchantDebt[] | null> {
  const client = getSupabase();
  if (!client || !userId) return null;
  try {
    const { data: mrows, error } = await client
      .from('merchant_debts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !mrows) return null;
    return mrows.map((row: Record<string, unknown>) => rowToDebt(row));
  } catch {
    return null;
  }
}

export async function fetchAccountData(userId: string): Promise<AccountData> {
  const empty: AccountData = {
    xp: 0,
    debtsPaid: 0,
    totalDonated: 0,
    streak: 0,
    lastActionDate: null,
    history: [],
    merchantDebts: [],
  };

  const client = getSupabase();
  if (!client || !userId) return empty;

  // 1. Özet istatistikler (liderlik snapshot'ı = otorite kaynak)
  try {
    const { data: snap } = await client
      .from('device_snapshots')
      .select('total_xp, debts_paid, total_donated, streak')
      .eq('user_id', userId)
      .maybeSingle();
    if (snap) {
      empty.xp = Number(snap.total_xp || 0);
      empty.debtsPaid = Number(snap.debts_paid || 0);
      empty.totalDonated = Number(snap.total_donated || 0);
      empty.streak = Number(snap.streak || 0);
    }
  } catch {}

  // 2. İyilik geçmişi (anket gönderimlerinden yeniden kurulur)
  try {
    const { data: rows } = await client
      .from('survey_submissions')
      .select(
        'id, debt_id, created_at, debt_category, debt_title, debt_amount, debt_urgency, pre_emotion, post_emotion, will_repeat, xp_gained',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (rows) {
      empty.history = rows.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        debtId: String(r.debt_id || ''),
        date: String(r.created_at || new Date().toISOString()),
        category: (r.debt_category as Category) || 'gida',
        title: String(r.debt_title || ''),
        amount: Number(r.debt_amount || 0),
        xp: Number(r.xp_gained || 0),
        preEmotion: (r.pre_emotion as HistoryEntry['preEmotion']) || 'huzur',
        postEmotion: (r.post_emotion as HistoryEntry['postEmotion']) || 'mutlu',
        willRepeat: (r.will_repeat as HistoryEntry['willRepeat']) || 'belki',
        urgency: Number(r.debt_urgency || 2),
      }));
      empty.lastActionDate = empty.history[0]?.date.slice(0, 10) ?? null;
    }
  } catch {}

  // 3. Esnafın kendi defteri (eklediği borçlar)
  empty.merchantDebts = (await fetchMyMerchantDebts(userId)) ?? [];

  return empty;
}

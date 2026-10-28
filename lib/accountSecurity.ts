// ============================================================
// Hesap güvenliği: 2 adımlı doğrulama (TOTP) + kurtarma e-postası + şifre sıfırlama
// ────────────────────────────────────────────────────────────
// Hesaplar kullanıcı-adı@dzimem.app sentetik e-postasıyla açılır; bu adrese
// posta gitmez. Şifre kurtarma isteyen kullanıcı Profil'den GERÇEK bir e-posta
// ekler; auth e-postası o adrese geçer ve Supabase'in kendi e-posta sistemi
// 6 haneli kod gönderir (bağlantı yok → APK'da derin bağlantı gerekmez).
//
// Kullanıcı adı hiçbir zaman kaybolmaz: user_metadata.username'de tutulur ve
// veritabanı tetikleyicisi o adı başka birinin almasını engeller.
//
// 2 adımlı doğrulama açıksa: şifre (veya e-posta kodu) yalnızca aal1 oturum
// verir. Veritabanı kuralları aal2 olmadan hiçbir veriye erişime izin vermez;
// yani e-posta ile şifre sıfırlamak 2FA'yı atlatmaz.
// ============================================================

import type { Factor, User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { AgeGroup } from './research';
import { isSyntheticEmail, isValidPassword, normalizeUsername, usernameToEmail } from './auth';

export type SecurityErrorCode =
  | 'not_configured'
  | 'invalid_email'
  | 'email_taken'
  | 'invalid_code'
  | 'rate_limited'
  | 'weak_password'
  | 'same_password'
  | 'mfa_required'
  | 'network'
  | 'generic';

export type SecurityResult<T = object> = ({ ok: true } & T) | { ok: false; error: SecurityErrorCode };

function mapSecurityError(err: unknown): SecurityErrorCode {
  const e = (err ?? {}) as { code?: string; message?: string; status?: number };
  const code = e.code ?? '';
  const msg = (e.message ?? '').toLowerCase();
  // 1) Kesin hata kodları (supabase auth-js error-codes)
  switch (code) {
    case 'email_exists':
      return 'email_taken';
    case 'email_address_invalid':
      return 'invalid_email';
    case 'otp_expired':
    case 'mfa_verification_failed':
    case 'mfa_challenge_expired':
      return 'invalid_code';
    case 'same_password':
      return 'same_password';
    case 'weak_password':
      return 'weak_password';
    case 'insufficient_aal':
      return 'mfa_required';
  }
  // 2) Mesaj tabanlı yedek (sıra önemli: "Token has expired or is invalid"
  //    bir kod hatasıdır, e-posta hatası değil)
  if (code.startsWith('over_') || e.status === 429 || msg.includes('rate limit') || msg.includes('security purposes')) {
    return 'rate_limited';
  }
  if (msg.includes('token') || msg.includes('otp') || msg.includes('totp') || msg.includes('verification')) {
    return 'invalid_code';
  }
  if (msg.includes('already been registered') || msg.includes('already registered')) return 'email_taken';
  if (msg.includes('email') && msg.includes('invalid')) return 'invalid_email';
  if (msg.includes('password should')) return 'weak_password';
  if (msg.includes('aal2')) return 'mfa_required';
  if (msg.includes('database error')) return 'email_taken'; // kullanıcı adı rezervasyon tetikleyicisi
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) return 'network';
  return 'generic';
}

export function securityErrorKey(code: SecurityErrorCode): string {
  return `security.err_${code}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidRecoveryEmail(email: string): boolean {
  const v = email.trim().toLowerCase();
  return v.length <= 254 && EMAIL_RE.test(v) && !isSyntheticEmail(v);
}

/** Doğrulayıcı uygulama (TOTP) kodu: her zaman 6 hane. */
export function isValidTotp(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/** E-posta kodu: Supabase projesine göre 6–10 hane ("Email OTP Length"). */
export const EMAIL_CODE_MAX = 10;
export function isValidEmailCode(code: string): boolean {
  return /^\d{6,10}$/.test(code.trim());
}

// ─── 2 adımlı doğrulama (TOTP) ───────────────────────────────

/** Oturum şifreyle açılmış ama hesabın 2FA'sı var ve henüz kod girilmemiş mi? */
export async function needsMfa(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    return !error && data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
  } catch {
    return false;
  }
}

async function verifiedTotpFactor(): Promise<Factor | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) return null;
  return data.totp[0] ?? null;
}

/** Girişte istenen 6 haneli doğrulama kodunu kontrol eder → oturum aal2 olur. */
export async function verifyLoginTotp(code: string): Promise<SecurityResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  if (!isValidTotp(code)) return { ok: false, error: 'invalid_code' };
  try {
    const factor = await verifiedTotpFactor();
    if (!factor) return { ok: false, error: 'generic' };
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (error) return { ok: false, error: mapSecurityError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

export async function getTotpFactor(): Promise<Factor | null> {
  try {
    return await verifiedTotpFactor();
  } catch {
    return null;
  }
}

export interface TotpEnrollment {
  factorId: string;
  qrCode: string; // data:image/svg+xml URL
  secret: string; // uygulamaya elle girilecek anahtar
  uri: string; // otpauth:// — telefonda doğrudan doğrulayıcı uygulamayı açar
}

export async function startTotpEnrollment(): Promise<SecurityResult<{ enrollment: TotpEnrollment }>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  try {
    // Yarım kalmış (doğrulanmamış) eski kayıtları temizle; aynı adla ikinci
    // kayıt Supabase tarafından reddedilir.
    const { data: list } = await client.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.factor_type === 'totp' && f.status !== 'verified') {
        await client.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'D-Zimem',
      issuer: 'D-Zimem',
    });
    if (error || !data || data.type !== 'totp') return { ok: false, error: mapSecurityError(error) };
    return {
      ok: true,
      enrollment: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
    };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<SecurityResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  if (!isValidTotp(code)) return { ok: false, error: 'invalid_code' };
  try {
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) return { ok: false, error: mapSecurityError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.auth.mfa.unenroll({ factorId });
  } catch {}
}

/** 2FA'yı kapatmak aal2 oturum ister: önce güncel kodla doğrula, sonra kaldır. */
export async function disableTotp(code: string): Promise<SecurityResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  if (!isValidTotp(code)) return { ok: false, error: 'invalid_code' };
  try {
    const factor = await verifiedTotpFactor();
    if (!factor) return { ok: true };
    const verify = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (verify.error) return { ok: false, error: mapSecurityError(verify.error) };
    const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return { ok: false, error: mapSecurityError(error) };
    // Yeni (aal1) belirteç al; aksi halde eski aal2 belirteci süresi dolana dek kalır.
    await client.auth.refreshSession();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

// ─── Kurtarma e-postası ──────────────────────────────────────

export interface RecoveryEmailState {
  email: string | null; // null → yalnızca kullanıcı adıyla giriş (kurtarma yok)
  verified: boolean;
}

export function recoveryEmailState(user: User | null | undefined): RecoveryEmailState {
  if (!user?.email || isSyntheticEmail(user.email)) return { email: null, verified: false };
  const m = (user.user_metadata || {}) as Record<string, unknown>;
  // Google ile bağlı hesabın e-postasını Google zaten doğrulamıştır.
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
  const viaGoogle = user.app_metadata?.provider === 'google' || providers.includes('google');
  return {
    email: user.email,
    verified: viaGoogle || (typeof m.recoveryVerifiedFor === 'string' && m.recoveryVerifiedFor === user.email),
  };
}

// 'email_change'→ Supabase değişikliği onaya bağladı (canlı projedeki durum): kod
//                 YENİ adrese gider, doğrulanana dek auth e-postası değişmez. Böylece
//                 sahiplik, adres hesaba bağlanmadan ÖNCE kanıtlanır.
//                 ("Secure email change" KAPALI olmalı; açıksa eski — sentetik —
//                 adrese de onay gider ve değişiklik hiç tamamlanamaz.)
// 'recovery'    → Bazı yapılandırmalarda değişiklik hemen uygulanır; o zaman
//                 sahipliği şifre-sıfırlama koduyla doğrularız.
export type RecoveryVerifyMode = 'recovery' | 'email_change';

export async function startAddRecoveryEmail(
  emailInput: string,
  username: string,
): Promise<SecurityResult<{ mode: RecoveryVerifyMode; email: string }>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  const email = emailInput.trim().toLowerCase();
  if (!isValidRecoveryEmail(email)) return { ok: false, error: 'invalid_email' };
  try {
    const { data, error } = await client.auth.updateUser({
      email,
      // Auth e-postası değişince kullanıcı adı metadata'dan okunur.
      data: { username: normalizeUsername(username), recoveryVerifiedFor: null },
    });
    if (error) return { ok: false, error: mapSecurityError(error) };

    if (data.user?.email?.toLowerCase() === email) {
      const sent = await client.auth.resetPasswordForEmail(email);
      if (sent.error) return { ok: false, error: mapSecurityError(sent.error) };
      return { ok: true, mode: 'recovery', email };
    }
    return { ok: true, mode: 'email_change', email };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

export async function resendRecoveryCode(email: string, mode: RecoveryVerifyMode): Promise<SecurityResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  const normalized = email.trim().toLowerCase();
  try {
    // Kod hangi akışla gönderildiyse aynı türde yeniden gönderilmeli.
    const { error } =
      mode === 'email_change'
        ? await client.auth.resend({ type: 'email_change', email: normalized })
        : await client.auth.resetPasswordForEmail(normalized);
    if (error) return { ok: false, error: mapSecurityError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

export async function verifyRecoveryEmail(
  email: string,
  code: string,
  mode: RecoveryVerifyMode,
): Promise<SecurityResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  if (!isValidEmailCode(code)) return { ok: false, error: 'invalid_code' };
  const normalized = email.trim().toLowerCase();
  try {
    const { error } = await client.auth.verifyOtp({ email: normalized, token: code.trim(), type: mode });
    if (error) return { ok: false, error: mapSecurityError(error) };
    // Doğrulandı işareti yalnızca arayüz içindir (user_metadata kullanıcıca
    // yazılabilir); yetki kararı hiçbir yerde buna dayanmaz.
    await client.auth.updateUser({ data: { recoveryVerifiedFor: normalized } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

/** Kurtarma e-postasını kaldırıp yeniden kullanıcı adıyla girişe döner. */
export async function removeRecoveryEmail(username: string): Promise<SecurityResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  try {
    const { error } = await client.auth.updateUser({
      email: usernameToEmail(username),
      data: { recoveryVerifiedFor: null },
    });
    if (error) return { ok: false, error: mapSecurityError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

// ─── Şifremi unuttum ─────────────────────────────────────────

/** Her durumda "gönderildi" gibi davranır — kayıtlı e-postaları ele vermemek için. */
export async function requestPasswordReset(emailInput: string): Promise<SecurityResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  const email = emailInput.trim().toLowerCase();
  if (!isValidRecoveryEmail(email)) return { ok: false, error: 'invalid_email' };
  try {
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error) {
      const code = mapSecurityError(error);
      // Hız sınırı ve ağ hatası dışındakileri kullanıcıya yansıtma.
      if (code === 'rate_limited' || code === 'network') return { ok: false, error: code };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

/** E-postadaki kodu doğrular → geçici oturum açılır (2FA varsa aal1). */
export async function verifyPasswordResetCode(
  emailInput: string,
  code: string,
): Promise<SecurityResult<{ mfaRequired: boolean }>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  if (!isValidEmailCode(code)) return { ok: false, error: 'invalid_code' };
  try {
    const { error } = await client.auth.verifyOtp({
      email: emailInput.trim().toLowerCase(),
      token: code.trim(),
      type: 'recovery',
    });
    if (error) return { ok: false, error: mapSecurityError(error) };
    return { ok: true, mfaRequired: await needsMfa() };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

export async function setNewPassword(password: string): Promise<SecurityResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  if (!isValidPassword(password)) return { ok: false, error: 'weak_password' };
  try {
    const { error } = await client.auth.updateUser({ password });
    if (error) return { ok: false, error: mapSecurityError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

// ─── Senkron AAL okuma (onAuthStateChange içinde güvenli) ────
// onAuthStateChange geri çağrısı içinde başka bir auth metodu beklemek
// supabase-js'in iç kilidinde kilitlenmeye yol açabilir. Bu yüzden AuthGate
// oturum nesnesinin kendisinden karar verir (getAuthenticatorAssuranceLevel
// ile aynı mantık: doğrulanmış faktör var ve belirteç aal2 değil).
function decodeJwtClaim(token: string, claim: string): unknown {
  try {
    const part = token.split('.')[1] ?? '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(
      Array.from(atob(padded), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    return (JSON.parse(json) as Record<string, unknown>)[claim];
  } catch {
    return undefined;
  }
}

export function sessionNeedsMfa(
  session: { access_token: string; user: Pick<User, 'factors'> } | null | undefined,
): boolean {
  if (!session) return false;
  const hasVerified = (session.user.factors ?? []).some((f) => f.status === 'verified');
  if (!hasVerified) return false;
  return decodeJwtClaim(session.access_token, 'aal') !== 'aal2';
}

// ─── E-postayla kayıt (6 haneli kod) ─────────────────────────
// Kayıt artık e-posta + kodla yapılır; e-posta sahipliği hesap açılmadan önce
// kanıtlanır ve her yeni hesap şifre kurtarmayı baştan kullanabilir.
//   1) startEmailSignUp  → signInWithOtp: Supabase kullanıcıyı (rastgele şifreyle)
//      oluşturur ve e-postaya kod gönderir. Hesap "signupCompleted: false".
//   2) verifySignUpCode  → kod doğrulanır, oturum açılır.
//   3) finishEmailSignUp → şifre + profil yazılır, hesap "signupCompleted: true".
// Yarım kalan kayıt (2-3 yapılmadı) e-postanın gerçek sahibi tarafından kod ile
// devralınabilir; TAMAMLANMIŞ hesaba bu yoldan girilemez (kullanıcı girişe/şifre
// sıfırlamaya yönlendirilir). Eski kullanıcı-adı hesaplarında bu alan hiç yoktur
// → tamamlanmış sayılır.

export interface EmailSignUpProfile {
  role: 'vatandas' | 'esnaf';
  displayName: string;
  shopName?: string;
  city?: string;
  consentAt: string;
  ageGroup: AgeGroup;
  guardianConsentAt?: string;
}

function signUpMetadata(p: EmailSignUpProfile) {
  return {
    role: p.role,
    displayName: p.displayName,
    shopName: p.shopName || null,
    city: p.city || null,
    consentAt: p.consentAt,
    ageGroup: p.ageGroup,
    guardianConsentAt: p.guardianConsentAt || null,
  };
}

export async function startEmailSignUp(
  emailInput: string,
  profile: EmailSignUpProfile,
): Promise<SecurityResult<{ email: string }>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  const email = emailInput.trim().toLowerCase();
  if (!isValidRecoveryEmail(email)) return { ok: false, error: 'invalid_email' };
  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { ...signUpMetadata(profile), createdAt: new Date().toISOString(), signupCompleted: false },
      },
    });
    if (error) return { ok: false, error: mapSecurityError(error) };
    return { ok: true, email };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

/** Kodu doğrular. existing=true → bu e-postayla tamamlanmış bir hesap var (oturum kapatılır). */
export async function verifySignUpCode(
  emailInput: string,
  code: string,
): Promise<SecurityResult<{ existing: boolean }>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  if (!isValidEmailCode(code)) return { ok: false, error: 'invalid_code' };
  try {
    const { data, error } = await client.auth.verifyOtp({
      email: emailInput.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    if (error || !data.user) return { ok: false, error: mapSecurityError(error) };
    const m = (data.user.user_metadata || {}) as Record<string, unknown>;
    if (m.signupCompleted !== false) {
      await client.auth.signOut();
      return { ok: true, existing: true };
    }
    return { ok: true, existing: false };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

export async function finishEmailSignUp(
  emailInput: string,
  password: string,
  profile: EmailSignUpProfile,
): Promise<SecurityResult<{ user: User }>> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  if (!isValidPassword(password)) return { ok: false, error: 'weak_password' };
  const email = emailInput.trim().toLowerCase();
  try {
    const { data, error } = await client.auth.updateUser({
      password,
      data: {
        ...signUpMetadata(profile),
        createdAt: new Date().toISOString(),
        signupCompleted: true,
        recoveryVerifiedFor: email,
      },
    });
    if (error || !data.user) return { ok: false, error: mapSecurityError(error) };
    // Profil bilgisi oturum anahtarına (JWT) ancak yenilemeyle geçer; RLS rolü oradan okur.
    try {
      await client.auth.refreshSession();
    } catch {}
    return { ok: true, user: data.user };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

/** Kullanıcının hesabını ve tüm araştırma verisini kalıcı olarak siler. */
export async function deleteMyAccount(): Promise<SecurityResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  try {
    const { error } = await client.rpc('delete_my_account');
    if (error) return { ok: false, error: mapSecurityError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapSecurityError(e) };
  }
}

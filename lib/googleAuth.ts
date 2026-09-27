// ============================================================
// Google ile giriş (Supabase OAuth + PKCE)
// ────────────────────────────────────────────────────────────
// Google, uygulama içi WebView'de girişi engeller; bu yüzden APK'da giriş
// telefonun tarayıcısında (Custom Tab) açılır ve com.dzimem.app://login-callback
// bağlantısıyla uygulamaya geri dönülür. Web'de normal yönlendirme kullanılır.
//
// Güvenlik: flowType 'pkce' (lib/supabase.ts). Dönüşteki "code", yalnızca bu
// cihazda saklanan code_verifier ile oturuma çevrilebilir; geri dönüş bağlantısını
// başka bir uygulama yakalasa bile kodla oturum açamaz.
// ============================================================

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { getSupabase } from './supabase';

export const NATIVE_REDIRECT = 'com.dzimem.app://login-callback';

export type GoogleAuthError = 'not_configured' | 'cancelled' | 'network' | 'already_linked' | 'account_exists' | 'generic';
export type GoogleFailure = { ok: false; error: GoogleAuthError; detail?: string };

function webRedirect(path = '/login/'): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${window.location.origin}${base}${path}`;
}

function mapError(message: string | undefined): GoogleAuthError {
  const msg = (message || '').toLowerCase();
  if (msg.includes('already linked') || msg.includes('identity is already')) return 'already_linked';
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) return 'not_configured';
  if (msg.includes('access_denied') || msg.includes('cancel')) return 'cancelled';
  // Bu e-posta başka bir (ör. kullanıcı adıyla açılmış) hesapta var ve Google ona
  // bağlı değil: Supabase otomatik bağlamaz, yeni hesap da açamaz.
  if (
    msg.includes('multiple accounts') ||
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('email_exists') ||
    msg.includes('saving new user') ||
    msg.includes('creating identity') ||
    msg.includes('linking domain')
  ) {
    return 'account_exists';
  }
  if (msg.includes('fetch') || msg.includes('network')) return 'network';
  return 'generic';
}

export function googleErrorKey(code: GoogleAuthError): string {
  return `auth.err_google_${code}`;
}

/** Google girişini başlatır. APK'da tarayıcı sekmesi açılır; web'de sayfa yönlenir. */
export async function startGoogleSignIn(): Promise<{ ok: true } | { ok: false; error: GoogleAuthError }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  const native = Capacitor.isNativePlatform();
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: native ? NATIVE_REDIRECT : webRedirect(),
        skipBrowserRedirect: native,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return { ok: false, error: mapError(error.message) };
    if (native) {
      if (!data?.url) return { ok: false, error: 'generic' };
      await Browser.open({ url: data.url, presentationStyle: 'popover' });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapError(e instanceof Error ? e.message : String(e)) };
  }
}

/**
 * Oturum açıkken Google hesabını MEVCUT hesaba bağlar (manuel bağlama).
 * Kullanıcı adıyla açılıp sonradan Gmail eklenen hesaplarda Supabase Google'ı
 * otomatik eşleştirmez; bir kez bağlanınca Google ile giriş aynı hesaba açılır.
 * Supabase'de "Allow manual linking" açık olmalı.
 */
export async function startGoogleLink(): Promise<{ ok: true } | { ok: false; error: GoogleAuthError | 'link_disabled' }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  const native = Capacitor.isNativePlatform();
  try {
    const { data, error } = await client.auth.linkIdentity({
      provider: 'google',
      options: {
        // Web'de bağlama sonrası Profil'e dön (dönüş kodunu AuthGate her sayfada işler).
        redirectTo: native ? NATIVE_REDIRECT : webRedirect('/profil/'),
        skipBrowserRedirect: native,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('manual linking')) return { ok: false, error: 'link_disabled' };
      if (msg.includes('already linked') || msg.includes('identity_already_exists')) return { ok: false, error: 'already_linked' };
      return { ok: false, error: mapError(error.message) };
    }
    if (native) {
      if (!data?.url) return { ok: false, error: 'generic' };
      await Browser.open({ url: data.url, presentationStyle: 'popover' });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapError(e instanceof Error ? e.message : String(e)) };
  }
}

/** Dönüş adresindeki kodu oturuma çevirir (PKCE). URL bizim dönüş adresimiz değilse yok sayar. */
async function completeFromUrl(url: string): Promise<{ ok: true } | GoogleFailure | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Supabase hata ayrıntısını hem sorgu (?…) hem parça (#…) kısmına yazabilir.
  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const pick = (key: string) => query.get(key) || hash.get(key);
  const code = query.get('code');
  const oauthError = pick('error_description') || pick('error_code') || pick('error');
  if (oauthError) return { ok: false, error: mapError(oauthError), detail: oauthError.slice(0, 200) };
  if (!code) return null;
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  try {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, error: mapError(error.message), detail: error.message.slice(0, 200) };
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapError(message), detail: message.slice(0, 200) };
  }
}

/**
 * APK: uygulama açıkken ya da dönüş bağlantısıyla açıldığında Google dönüşünü yakalar.
 * Oturum açılınca onAuthStateChange (AuthGate) gerisini halleder.
 */
export function listenForNativeOAuth(onError: (error: GoogleAuthError, detail?: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = async (url: string | undefined) => {
    if (!url || !url.startsWith(NATIVE_REDIRECT)) return;
    try {
      await Browser.close();
    } catch {}
    const result = await completeFromUrl(url);
    if (result && !result.ok) onError(result.error, result.detail);
  };
  void App.getLaunchUrl().then((launch) => handle(launch?.url));
  const listener = App.addListener('appUrlOpen', (event) => void handle(event.url));
  return () => {
    void listener.then((l) => l.remove());
  };
}

/** Web: /login/?code=… ile dönüldüyse oturumu tamamlar ve adres çubuğunu temizler. */
export async function completeWebOAuthIfPresent(): Promise<{ ok: true } | GoogleFailure | null> {
  if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return null;
  const result = await completeFromUrl(window.location.href);
  if (result) {
    const clean = window.location.pathname;
    window.history.replaceState(null, '', clean);
  }
  return result;
}

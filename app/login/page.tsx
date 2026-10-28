'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import type { User } from '@supabase/supabase-js';
import { signIn, signOut, fetchAccountData, profileFromMetadata, authErrorKey } from '@/lib/auth';
import { MFA_REQUIRED_EVENT, needsMfa } from '@/lib/accountSecurity';
import { getSupabase } from '@/lib/supabase';
import MfaCodeForm from '@/components/auth/MfaCodeForm';
import GoogleButton from '@/components/auth/GoogleButton';
import { GOOGLE_ERROR_EVENT, takeGoogleError } from '@/lib/googleAuth';


export default function LoginPage() {
  const router = useRouter();
  const profile = useZimemStore((s) => s.profile);
  const hydrateAccount = useZimemStore((s) => s.hydrateAccount);
  const { t } = useI18n();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  // Şifre doğru ama hesapta 2 adımlı doğrulama açık → kod adımı.
  const [mfaStep, setMfaStep] = useState(false);
  // Google hatalarında Supabase'in teknik açıklaması (teşhis için küçük yazıyla)
  const [errorDetail, setErrorDetail] = useState('');

  // Google dönüş hatası: sayfa açılırken (?google=hata) ve sayfa zaten açıkken (olay) gösterilir.
  const showGoogleError = () => {
    const found = takeGoogleError();
    if (!found) return;
    setError(t(`auth.err_google_${found.code}`));
    setErrorDetail(found.detail);
  };

  // Google dönüşünden sonra 2FA kodu gerekiyorsa (sayfa zaten açıkken) kod adımını aç.
  useEffect(() => {
    const openMfa = () => setMfaStep(true);
    window.addEventListener(MFA_REQUIRED_EVENT, openMfa);
    return () => window.removeEventListener(MFA_REQUIRED_EVENT, openMfa);
  }, []);

  useEffect(() => {
    window.addEventListener(GOOGLE_ERROR_EVENT, showGoogleError);
    return () => window.removeEventListener(GOOGLE_ERROR_EVENT, showGoogleError);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t dil değişince yenilenir; dinleyici yeniden kurulmalı
  }, [t]);

  useEffect(() => {
    setMounted(true);
    void (async () => {
      // APK: Google dönüşü başarısız olduysa AuthGate ?google=hata ile buraya yollar.
      if (new URLSearchParams(window.location.search).get('google') === 'hata') {
        showGoogleError();
        window.history.replaceState(null, '', window.location.pathname);
      }
      // AuthGate, kodu girilmemiş (aal1) oturumu buraya yönlendirir.
      if (await needsMfa()) setMfaStep(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca ilk açılışta
  }, []);
  useEffect(() => {
    if (mounted && profile) {
      router.replace(profile.role === 'esnaf' ? '/esnaf/' : '/');
    }
  }, [mounted, profile, router]);

  const canSubmit = username.trim().length >= 3 && password.length >= 6 && !busy;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setErrorDetail('');
    let r: Awaited<ReturnType<typeof signIn>>;
    try {
      r = await signIn(username, password);
    } catch {
      // Beklenmeyen istisna butonu kilitli bırakmamalı.
      setError(t(authErrorKey('network')));
      setBusy(false);
      return;
    }
    if (!r.ok || !r.user) {
      setError(t(authErrorKey(r.error)));
      setBusy(false);
      return;
    }
    if (await needsMfa()) {
      setMfaStep(true);
      setBusy(false);
      return;
    }
    await completeLogin(r.user);
  };

  const completeLogin = async (user: User) => {
    const prof = profileFromMetadata(user);
    // Hesap verisi çekilemezse bile giriş tamamlanmalı; veriler sonra senkronlanır.
    let data: Awaited<ReturnType<typeof fetchAccountData>>;
    try {
      data = await fetchAccountData(user.id);
    } catch {
      data = {
        xp: 0,
        debtsPaid: 0,
        totalDonated: 0,
        streak: 0,
        lastActionDate: null,
        history: [],
        merchantDebts: [],
      };
    }
    hydrateAccount(prof, data);
    router.replace(prof.role === 'esnaf' ? '/esnaf/' : '/');
  };

  const handleMfaVerified = async () => {
    const client = getSupabase();
    const { data } = client ? await client.auth.getUser() : { data: { user: null } };
    if (data.user) await completeLogin(data.user);
  };

  const handleMfaCancel = async () => {
    await signOut();
    setMfaStep(false);
    setPassword('');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-4">
      <div className="glass-strong w-full max-w-md p-5 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 to-blue-500 grid place-items-center text-3xl shadow-lg shadow-indigo-500/40 ring-1 ring-white/10 mb-3">
              📖
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-none">D-Zimem</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300/90 font-semibold mt-1.5">
              Kadim İyilik · Dijital İz
            </p>
            <p className="text-sm text-muted-c mt-3">{t('auth.login_subtitle')}</p>
          </div>

          {mfaStep ? (
            <MfaCodeForm onVerified={handleMfaVerified} onCancel={handleMfaCancel} />
          ) : (
          <>
          <GoogleButton onError={setError} />
          <div className="flex items-center gap-3 my-5 text-xs text-muted-c uppercase tracking-wider">
            <span className="flex-1 h-px bg-white/10" />
            {t('auth.or')}
            <span className="flex-1 h-px bg-white/10" />
          </div>
          <div className="space-y-4">
            <AuthField
              label={t('auth.identifier_label')}
              value={username}
              onChange={setUsername}
              placeholder={t('auth.identifier_ph')}
              autoComplete="username"
              onEnter={handleLogin}
            />
            <AuthField
              label={t('auth.password_label')}
              value={password}
              onChange={setPassword}
              placeholder={t('auth.password_ph')}
              type="password"
              autoComplete="current-password"
              onEnter={handleLogin}
            />
          </div>

          {error && (
            <div className="mt-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
              {errorDetail && <div className="text-[11px] text-red-200/60 mt-1.5 break-words">{errorDetail}</div>}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary w-full mt-6"
            disabled={!canSubmit}
            onClick={handleLogin}
          >
            {busy ? t('auth.logging_in') : t('auth.login_btn')}
          </button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => router.push('/sifremi-unuttum/')}
              className="text-[13px] text-muted-c hover:text-white bg-transparent border-0 p-0 cursor-pointer"
            >
              {t('auth.forgot_link')}
            </button>
          </div>

          <p className="text-[13px] text-muted-c text-center mt-6">
            {t('auth.no_account')}{' '}
            <button
              type="button"
              onClick={() => router.push('/register/')}
              className="text-amber-300 font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer align-baseline"
            >
              {t('auth.register_link')}
            </button>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  onEnter?: () => void;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium mb-1">{label}</div>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) onEnter();
        }}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:bg-white/10 outline-none text-sm transition-all"
      />
    </label>
  );
}

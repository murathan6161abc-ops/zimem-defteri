'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import { profileFromMetadata, isValidPassword, setAuthCache } from '@/lib/auth';
import {
  finishEmailSignUp,
  EMAIL_CODE_MAX,
  isValidEmailCode,
  isValidRecoveryEmail,
  securityErrorKey,
  startEmailSignUp,
  verifySignUpCode,
  type EmailSignUpProfile,
} from '@/lib/accountSecurity';
import type { Role } from '@/types';
import GoogleButton from '@/components/auth/GoogleButton';
import LogoMark from '@/components/layout/LogoMark';

// Supabase varsa gerçek hesap (e-posta + 6 haneli kod + şifre); yoksa yerel profil.
const authMode = isSupabaseConfigured();
const SIGNUP_FLAG = 'd-zimem-signup-in-progress';
const RESEND_SECONDS = 60;

export default function RegisterPage() {
  const router = useRouter();
  const setProfile = useZimemStore((s) => s.setProfile);
  const hydrateAccount = useZimemStore((s) => s.hydrateAccount);
  const { t } = useI18n();

  const [step, setStep] = useState<'role' | 'details' | 'verify'>('role');
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // Kod bir kez doğrulandıysa (ör. şifre sunucuda reddedildi) tekrar doğrulanmaz.
  const [codeVerified, setCodeVerified] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [consentAt, setConsentAt] = useState('');
  const [info, setInfo] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Bilgilendirilmiş onam (araştırma etiği) — kayıt için zorunlu
  const [consent, setConsent] = useState(false);
  const [kvkkOpen, setKvkkOpen] = useState(false);

  const credsOk = !authMode || (isValidRecoveryEmail(email) && isValidPassword(password));

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const buildProfile = (at: string): EmailSignUpProfile => ({
    role: role ?? 'vatandas',
    displayName: displayName.trim(),
    shopName: role === 'esnaf' ? shopName.trim() : undefined,
    city: city.trim() || undefined,
    consentAt: at,
  });

  // Kayıt formu → e-postaya 6 haneli kod gönder
  const sendCode = async () => {
    if (!role) return;
    const at = consentAt || new Date().toISOString();
    setBusy(true);
    setError('');
    const r = await startEmailSignUp(email, buildProfile(at));
    setBusy(false);
    if (!r.ok) {
      setError(t(securityErrorKey(r.error)));
      return;
    }
    setConsentAt(at);
    setCode('');
    setCodeVerified(false);
    setExistingAccount(false);
    setInfo(t('register.code_sent', { email: r.email }));
    setResendIn(RESEND_SECONDS);
    setStep('verify');
  };

  // Kod → (bir kez) doğrula → şifre + profil yaz → uygulamaya gir
  const verifyAndFinish = async () => {
    if (busy || !role) return;
    setBusy(true);
    setError('');
    try { sessionStorage.setItem(SIGNUP_FLAG, '1'); } catch {}

    if (!codeVerified) {
      const v = await verifySignUpCode(email, code);
      if (!v.ok) {
        setError(t(securityErrorKey(v.error)));
        setCode('');
        setBusy(false);
        return;
      }
      if (v.existing) {
        try { sessionStorage.removeItem(SIGNUP_FLAG); } catch {}
        setExistingAccount(true);
        setBusy(false);
        return;
      }
      setCodeVerified(true);
    }

    const f = await finishEmailSignUp(email, password, buildProfile(consentAt));
    if (!f.ok) {
      // Kod zaten doğrulandı; kullanıcı yalnızca şifresini değiştirip tekrar dener.
      setError(t(securityErrorKey(f.error)));
      setBusy(false);
      return;
    }
    setAuthCache(f.user.id);
    // AuthGate'in "register'da otomatik logout" kuralı yeni oturumu silmesin.
    try { sessionStorage.setItem('d-zimem-skip-register-logout', '1'); } catch {}
    hydrateAccount(profileFromMetadata(f.user), {
      xp: 0,
      debtsPaid: 0,
      totalDonated: 0,
      streak: 0,
      lastActionDate: null,
      history: [],
      merchantDebts: [],
    });
    router.replace(role === 'esnaf' ? '/esnaf/' : '/');
  };
  const canFinish =
    role !== null &&
    displayName.trim().length >= 2 &&
    (role !== 'esnaf' || shopName.trim().length >= 2) &&
    consent &&
    credsOk &&
    !busy;

  const handleFinish = async () => {
    if (!canFinish || !role) return;
    const now = new Date().toISOString();
    const shop = role === 'esnaf' ? shopName.trim() : undefined;
    const cityVal = city.trim() || undefined;

    if (authMode) {
      await sendCode();
      return;
    }

    // Supabase ayarlı değil: profil yalnızca bu cihazda tutulur. Bayrak olmadan AuthGate,
    // kayıt sayfasında profil görünce "yeni hesap açılıyor" sayıp çıkış yapar.
    try { sessionStorage.setItem('d-zimem-skip-register-logout', '1'); } catch {}
    setProfile({
      role,
      displayName: displayName.trim(),
      shopName: shop,
      city: cityVal,
      createdAt: now,
      consentAt: now,
    });
    router.replace(role === 'esnaf' ? '/esnaf/' : '/');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-4">
      <div className="glass-strong w-full max-w-lg p-5 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex flex-col items-center text-center mb-7">
            <div className="mb-3">
              <LogoMark size="lg" />
            </div>
            <h1 className="heading-xl mb-1">{t('register.welcome')}</h1>
            <p className="text-sm text-muted-c">{t('register.subtitle')}</p>
          </div>

          {step === 'role' && (
            <>
              <div className="section-title text-center mb-4">{t('register.who_are_you')}</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('vatandas')}
                  className={`emotion-card !p-4 sm:!p-6 ${role === 'vatandas' ? 'selected' : ''}`}
                >
                  <div className="font-bold text-base mb-1">{t('register.citizen')}</div>
                  <div className="text-[11px] sm:text-xs text-muted-c leading-relaxed">
                    {t('register.citizen_desc')}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('esnaf')}
                  className={`emotion-card !p-4 sm:!p-6 ${role === 'esnaf' ? 'selected' : ''}`}
                >
                  <div className="font-bold text-base mb-1">{t('register.merchant')}</div>
                  <div className="text-[11px] sm:text-xs text-muted-c leading-relaxed">
                    {t('register.merchant_desc')}
                  </div>
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary w-full mt-7"
                disabled={!role}
                onClick={() => setStep('details')}
              >
                {t('common.continue_arrow')}
              </button>

              {authMode && (
                <>
                  <div className="flex items-center gap-3 my-5 text-[11px] text-muted-c uppercase tracking-wider">
                    <span className="flex-1 h-px bg-white/10" />
                    {t('auth.or')}
                    <span className="flex-1 h-px bg-white/10" />
                  </div>
                  {/* Google ile ilk girişte rol ve onam "profilini tamamla" ekranında alınır. */}
                  <GoogleButton onError={setError} />
                  {error && (
                    <div className="mt-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                      {error}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {step === 'details' && role && (
            <>
              <div className="section-title text-center mb-4">
                {role === 'esnaf' ? t('register.merchant_details') : t('register.citizen_details')}
              </div>

              <div className="space-y-4">
                {authMode && (
                  <>
                    <Field
                      label={t('register.email_label')}
                      hint={t('register.email_hint')}
                      value={email}
                      onChange={(v) => setEmail(v.trim())}
                      placeholder={t('register.email_ph')}
                      type="email"
                      autoComplete="email"
                    />
                    <Field
                      label={t('auth.password_label')}
                      hint={t('auth.password_hint')}
                      value={password}
                      onChange={setPassword}
                      placeholder={t('auth.password_ph')}
                      type="password"
                      autoComplete="new-password"
                    />
                  </>
                )}

                <Field
                  label={t('register.nickname_label')}
                  hint={t('register.nickname_hint')}
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder={role === 'esnaf' ? t('register.nickname_ph_merchant') : t('register.nickname_ph_citizen')}
                />

                {role === 'esnaf' && (
                  <Field
                    label={t('register.shop_label')}
                    hint={t('register.shop_hint')}
                    value={shopName}
                    onChange={setShopName}
                    placeholder={t('register.shop_ph')}
                  />
                )}

                <Field
                  label={t('register.city_label')}
                  hint=""
                  value={city}
                  onChange={setCity}
                  placeholder={t('register.city_ph')}
                />
              </div>

              {/* Aydınlatma metni + bilgilendirilmiş gönüllü onam (araştırma etiği / KVKK) */}
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setKvkkOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
                  aria-expanded={kvkkOpen}
                >
                  <span className="text-[13px] font-semibold flex items-center gap-2">
                    {t('register.consent_title')}
                  </span>
                  <span className={`text-muted-c transition-transform ${kvkkOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {kvkkOpen && (
                  <div className="px-4 pb-4 text-[11px] text-muted-c leading-relaxed space-y-2 border-t border-white/5 pt-3">
                    <p>{t('register.consent_p1')}</p>
                    <p>{t('register.consent_p2')}</p>
                    <p>{t('register.consent_p3')}</p>
                    <p>{t('register.consent_p4')}</p>
                  </div>
                )}
              </div>

              <label className="mt-3 flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-amber-400"
                />
                <span className="text-[12px] text-muted-c leading-relaxed">
                  {t('register.consent_checkbox')}
                </span>
              </label>

              {error && (
                <div className="mt-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex gap-2 mt-7">
                <button
                  type="button"
                  className="btn flex-1"
                  onClick={() => setStep('role')}
                >
                  {t('common.back_arrow')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={!canFinish}
                  onClick={handleFinish}
                >
                  {busy ? t('auth.registering') : t('register.finish')}
                </button>
              </div>

              {authMode && (
                <p className="text-[13px] text-muted-c text-center mt-4">
                  {t('auth.have_account')}{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/login/')}
                    className="text-amber-300 font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer align-baseline"
                  >
                    {t('auth.login_link')}
                  </button>
                </p>
              )}
            </>
          )}

          {step === 'verify' && role && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="font-bold">{t('register.verify_title')}</div>
                {info && <p className="text-sm text-muted-c mt-1">{info}</p>}
              </div>

              {existingAccount ? (
                <div className="space-y-3">
                  <div className="text-[13px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    {t('register.email_exists')}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="btn" onClick={() => router.push('/sifremi-unuttum/')}>
                      {t('auth.forgot_link')}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => router.push('/login/')}>
                      {t('auth.login_link')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {!codeVerified && (
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={EMAIL_CODE_MAX}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, EMAIL_CODE_MAX))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && isValidEmailCode(code)) void verifyAndFinish();
                      }}
                      placeholder="123456"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 outline-none text-center text-2xl tracking-[0.4em] font-mono"
                    />
                  )}
                  {codeVerified && (
                    <Field
                      label={t('auth.password_label')}
                      hint={t('auth.password_hint')}
                      value={password}
                      onChange={setPassword}
                      placeholder={t('auth.password_ph')}
                      type="password"
                      autoComplete="new-password"
                    />
                  )}

                  {error && (
                    <div className="text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    disabled={busy || (codeVerified ? !isValidPassword(password) : !isValidEmailCode(code))}
                    onClick={() => void verifyAndFinish()}
                  >
                    {busy ? t('auth.registering') : t('register.verify_btn')}
                  </button>

                  {!codeVerified && (
                    <div className="flex items-center justify-between text-[12px]">
                      <button
                        type="button"
                        className="text-muted-c hover:text-white bg-transparent border-0 p-0"
                        disabled={busy}
                        onClick={() => {
                          setError('');
                          setStep('details');
                        }}
                      >
                        {t('register.change_email')}
                      </button>
                      <button
                        type="button"
                        className="text-muted-c hover:text-white bg-transparent border-0 p-0 disabled:opacity-50"
                        disabled={busy || resendIn > 0}
                        onClick={() => void sendCode()}
                      >
                        {resendIn > 0 ? t('register.resend_wait', { s: resendIn }) : t('security.resend')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-c text-center mt-6 opacity-70">
            {t('register.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium mb-1">{label}</div>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:bg-white/10 outline-none text-sm transition-all"
      />
      {hint && <div className="text-[11px] text-muted-c mt-1">{hint}</div>}
    </label>
  );
}

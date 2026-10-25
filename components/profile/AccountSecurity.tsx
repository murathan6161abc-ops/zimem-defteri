'use client';
import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useI18n } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase';
import { isValidUsername } from '@/lib/auth';
import { googleErrorKey, startGoogleLink } from '@/lib/googleAuth';
import {
  cancelTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  getTotpFactor,
  EMAIL_CODE_MAX,
  isValidEmailCode,
  isValidTotp,
  isValidRecoveryEmail,
  recoveryEmailState,
  removeRecoveryEmail,
  resendRecoveryCode,
  securityErrorKey,
  startAddRecoveryEmail,
  startTotpEnrollment,
  verifyRecoveryEmail,
  type RecoveryVerifyMode,
  type SecurityErrorCode,
  type TotpEnrollment,
} from '@/lib/accountSecurity';

const inputCls =
  'w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 outline-none text-sm';
const codeCls = `${inputCls} text-center text-xl tracking-[0.35em] font-mono`;

function CodeInput({ value, onChange, max = 6 }: { value: string; onChange: (v: string) => void; max?: number }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={max}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, max))}
      placeholder="123456"
      className={codeCls}
    />
  );
}

function Msg({ kind, children }: { kind: 'error' | 'info'; children: React.ReactNode }) {
  const cls =
    kind === 'error'
      ? 'text-red-300 bg-red-500/10 border-red-500/20'
      : 'text-emerald-200 bg-emerald-500/10 border-emerald-500/20';
  return <div className={`text-[12px] border rounded-xl px-3 py-2 ${cls}`}>{children}</div>;
}

export default function AccountSecurity({ username }: { username: string }) {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);

  const refreshUser = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    try {
      const { data } = await client.auth.getUser();
      setUser(data.user ?? null);
    } catch {}
  }, []);

  useEffect(() => {
    void refreshUser();
    // Google bağlama dönüşü / e-posta doğrulaması sonrası kartlar güncellensin.
    // (Geri çağrı içinde başka auth metodu çağırmıyoruz — kilitlenme riski.)
    const client = getSupabase();
    if (!client) return;
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshUser]);

  if (!user) return null;

  return (
    <section className="glass p-5 mb-6 space-y-6">
      <div className="section-title">{t('security.section')}</div>
      <RecoveryEmailCard user={user} username={username} onChanged={refreshUser} />
      <div className="border-t border-white/5" />
      <GoogleLinkCard user={user} />
      <div className="border-t border-white/5" />
      <TwoFactorCard />
    </section>
  );
}

// Kurtarma e-postası
function RecoveryEmailCard({
  user,
  username,
  onChanged,
}: {
  user: User;
  username: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const state = recoveryEmailState(user);
  const [email, setEmail] = useState('');
  const [email2, setEmail2] = useState('');
  const [pending, setPending] = useState<{ email: string; mode: RecoveryVerifyMode } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const fail = (code: SecurityErrorCode) => {
    setError(t(securityErrorKey(code)));
    setBusy(false);
  };

  const start = async () => {
    setError('');
    setInfo('');
    if (!isValidRecoveryEmail(email)) return fail('invalid_email');
    if (email.trim().toLowerCase() !== email2.trim().toLowerCase()) {
      setError(t('security.email_mismatch'));
      return;
    }
    if (!username) return fail('generic');
    setBusy(true);
    const r = await startAddRecoveryEmail(email, username);
    if (!r.ok) return fail(r.error);
    setPending({ email: r.email, mode: r.mode });
    setInfo(t('security.email_code_sent', { email: r.email }));
    setBusy(false);
    await onChanged();
  };

  const verify = async () => {
    const target = pending ?? (state.email ? { email: state.email, mode: 'recovery' as const } : null);
    if (!target || !isValidEmailCode(code)) return;
    setBusy(true);
    setError('');
    const r = await verifyRecoveryEmail(target.email, code, target.mode);
    if (!r.ok) return fail(r.error);
    setPending(null);
    setCode('');
    setEmail('');
    setEmail2('');
    setInfo(t('security.email_login_note'));
    setBusy(false);
    await onChanged();
  };

  const resend = async () => {
    const target = pending ?? (state.email ? { email: state.email, mode: 'recovery' as const } : null);
    if (!target) return;
    setBusy(true);
    setError('');
    const r = await resendRecoveryCode(target.email, target.mode);
    if (!r.ok) return fail(r.error);
    setPending(target);
    setInfo(t('security.resent'));
    setBusy(false);
  };

  // Onay bekleyen değişiklikten vazgeç: auth e-postası henüz değişmediği için
  // sunucuda yapılacak bir şey yok; bekleyen istek kendiliğinden geçersiz olur.
  const cancelPending = () => {
    setPending(null);
    setCode('');
    setInfo('');
    setError('');
  };

  const remove = async () => {
    if (!username || !confirm(t('security.email_remove_confirm'))) return;
    setBusy(true);
    setError('');
    const r = await removeRecoveryEmail(username);
    if (!r.ok) return fail(r.error);
    setPending(null);
    setCode('');
    setInfo('');
    setBusy(false);
    await onChanged();
  };

  const awaitingCode = !!pending || (!!state.email && !state.verified);

  return (
    <div className="space-y-3">
      <div>
        <div className="font-semibold text-sm">{t('security.email_title')}</div>
        <p className="text-xs text-muted-c mt-1">
          {isValidUsername(username) ? t('security.email_desc') : t('security.email_desc_short')}
        </p>
      </div>

      {state.email ? (
        <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
          <span className="font-mono text-xs truncate">{state.email}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${state.verified ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
            {state.verified ? t('security.email_verified') : t('security.email_unverified')}
          </span>
        </div>
      ) : (
        !pending && <p className="text-xs text-amber-300/90">{t('security.email_none')}</p>
      )}

      {!state.email && !pending && (
        <div className="space-y-2">
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('security.email_label')} className={inputCls} />
          <input type="email" inputMode="email" autoComplete="off" value={email2} onChange={(e) => setEmail2(e.target.value)} placeholder={t('security.email_confirm_label')} className={inputCls} />
          <button type="button" className="btn btn-primary w-full" disabled={busy || !email || !email2} onClick={() => void start()}>
            {busy ? t('common.loading') : t('security.email_send')}
          </button>
        </div>
      )}

      {awaitingCode && (
        <div className="space-y-2">
          <div className="text-xs text-muted-c">{t('security.code_label')}</div>
          <CodeInput value={code} onChange={setCode} max={EMAIL_CODE_MAX} />
          <button type="button" className="btn btn-primary w-full" disabled={busy || !isValidEmailCode(code)} onClick={() => void verify()}>
            {busy ? t('common.loading') : t('security.verify_btn')}
          </button>
          <button type="button" className="w-full text-[12px] text-muted-c hover:text-white bg-transparent border-0" disabled={busy} onClick={() => void resend()}>
            {t('security.resend')}
          </button>
          {pending && !state.email && (
            <button type="button" className="w-full text-[12px] text-muted-c hover:text-white bg-transparent border-0" disabled={busy} onClick={cancelPending}>
              {t('security.cancel')}
            </button>
          )}
        </div>
      )}

      {/* Yalnızca kullanıcı adıyla açılmış eski hesaplar e-postayı kaldırıp kullanıcı
          adına dönebilir; e-postayla açılan hesabın dönebileceği bir kullanıcı adı yok. */}
      {state.email && isValidUsername(username) && (
        <button type="button" className="text-[12px] text-red-300/80 hover:text-red-300 bg-transparent border-0 p-0" disabled={busy} onClick={() => void remove()}>
          {t('security.email_remove')}
        </button>
      )}

      {info && <Msg kind="info">{info}</Msg>}
      {error && <Msg kind="error">{error}</Msg>}
    </div>
  );
}

// Google hesabı bağlama
function GoogleLinkCard({ user }: { user: User }) {
  const { t } = useI18n();
  const linked = (user.identities ?? []).some((i) => i.provider === 'google');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState('');

  // Uygulamaya dönüşte bağlama başarısız olduysa AuthGate kodu buraya bırakır.
  useEffect(() => {
    try {
      const code = sessionStorage.getItem('d-zimem-google-error');
      if (code) {
        setDetail(sessionStorage.getItem('d-zimem-google-error-detail') || '');
        sessionStorage.removeItem('d-zimem-google-error');
        sessionStorage.removeItem('d-zimem-google-error-detail');
        setError(t(`auth.err_google_${code}`));
      }
    } catch {}
  }, [t]);

  const link = async () => {
    setBusy(true);
    setError('');
    const r = await startGoogleLink();
    if (!r.ok) setError(r.error === 'link_disabled' ? t('security.google_link_disabled') : t(googleErrorKey(r.error)));
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{t('security.google_title')}</div>
          <p className="text-xs text-muted-c mt-1">{t('security.google_desc')}</p>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${linked ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-muted-c'}`}>
          {linked ? t('security.google_linked') : t('security.google_not_linked')}
        </span>
      </div>
      {!linked && (
        <button type="button" className="btn w-full" disabled={busy} onClick={() => void link()}>
          {busy ? t('common.loading') : t('security.google_link_btn')}
        </button>
      )}
      {error && (
        <Msg kind="error">
          {error}
          {detail && <div className="text-[10px] opacity-60 mt-1 break-words">{detail}</div>}
        </Msg>
      )}
    </div>
  );
}

// İki adımlı doğrulama (TOTP)
function TwoFactorCard() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void getTotpFactor().then((f) => setEnabled(!!f));
  }, []);

  const fail = (c: SecurityErrorCode) => {
    setError(t(securityErrorKey(c)));
    setBusy(false);
  };

  const begin = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    const r = await startTotpEnrollment();
    if (!r.ok) return fail(r.error);
    setEnrollment(r.enrollment);
    setCode('');
    setBusy(false);
  };

  const confirmEnroll = async () => {
    if (!enrollment || !isValidTotp(code)) return;
    setBusy(true);
    setError('');
    const r = await confirmTotpEnrollment(enrollment.factorId, code);
    if (!r.ok) {
      setCode('');
      return fail(r.error);
    }
    setEnrollment(null);
    setEnabled(true);
    setCode('');
    setInfo(t('security.mfa_enabled_toast'));
    setBusy(false);
  };

  const cancelEnroll = async () => {
    if (enrollment) await cancelTotpEnrollment(enrollment.factorId);
    setEnrollment(null);
    setCode('');
    setError('');
  };

  const confirmDisable = async () => {
    if (!isValidTotp(code)) return;
    setBusy(true);
    setError('');
    const r = await disableTotp(code);
    if (!r.ok) {
      setCode('');
      return fail(r.error);
    }
    setEnabled(false);
    setDisabling(false);
    setCode('');
    setBusy(false);
  };

  const copySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (enabled === null) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{t('security.mfa_title')}</div>
          <p className="text-xs text-muted-c mt-1">{t('security.mfa_desc')}</p>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-muted-c'}`}>
          {enabled ? t('security.mfa_on') : t('security.mfa_off')}
        </span>
      </div>

      {!enabled && !enrollment && (
        <button type="button" className="btn w-full" disabled={busy} onClick={() => void begin()}>
          {busy ? t('common.loading') : t('security.mfa_enable')}
        </button>
      )}

      {enrollment && (
        <div className="space-y-3">
          <p className="text-xs">{t('security.mfa_step1')}</p>
          <div className="bg-white rounded-xl p-3 w-44 h-44 mx-auto">
            {enrollment.qrCode.startsWith('data:image/') && (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase'in ürettiği SVG data URL
              <img src={enrollment.qrCode} alt="QR" className="w-full h-full" />
            )}
          </div>
          {/* Yalnızca otpauth: şeması — sunucu yanıtı ne olursa olsun javascript: vb. bağlantı basılmaz. */}
          {enrollment.uri.startsWith('otpauth://') && (
            <a href={enrollment.uri} className="btn w-full text-center block no-underline">
              {t('security.mfa_open_app')}
            </a>
          )}
          <div className="text-xs text-muted-c">{t('security.mfa_secret')}</div>
          <div className="flex gap-2">
            <code className="flex-1 min-w-0 truncate text-xs font-mono px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              {enrollment.secret}
            </code>
            <button type="button" className="btn !px-3 text-xs" onClick={() => void copySecret()}>
              {copied ? t('security.mfa_copied') : t('security.mfa_copy')}
            </button>
          </div>
          <p className="text-xs">{t('security.mfa_step2')}</p>
          <CodeInput value={code} onChange={setCode} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" disabled={busy} onClick={() => void cancelEnroll()}>
              {t('security.cancel')}
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || !isValidTotp(code)} onClick={() => void confirmEnroll()}>
              {busy ? t('common.loading') : t('security.verify_btn')}
            </button>
          </div>
          <p className="text-[11px] text-muted-c">{t('security.mfa_lost_device')}</p>
        </div>
      )}

      {enabled && !disabling && (
        <button type="button" className="text-[12px] text-red-300/80 hover:text-red-300 bg-transparent border-0 p-0" onClick={() => { setDisabling(true); setCode(''); setError(''); setInfo(''); }}>
          {t('security.mfa_disable')}
        </button>
      )}

      {enabled && disabling && (
        <div className="space-y-2">
          <p className="text-xs text-muted-c">{t('security.mfa_disable_prompt')}</p>
          <CodeInput value={code} onChange={setCode} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" disabled={busy} onClick={() => { setDisabling(false); setCode(''); }}>
              {t('security.cancel')}
            </button>
            <button type="button" className="btn !text-red-300 !border-red-500/30" disabled={busy || !isValidTotp(code)} onClick={() => void confirmDisable()}>
              {busy ? t('common.loading') : t('security.mfa_disable')}
            </button>
          </div>
        </div>
      )}

      {info && <Msg kind="info">{info}</Msg>}
      {error && <Msg kind="error">{error}</Msg>}
    </div>
  );
}

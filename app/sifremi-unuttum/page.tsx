'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { isValidPassword } from '@/lib/auth';
import {
  EMAIL_CODE_MAX,
  isValidEmailCode,
  isValidRecoveryEmail,
  requestPasswordReset,
  securityErrorKey,
  setNewPassword,
  verifyPasswordResetCode,
} from '@/lib/accountSecurity';
import MfaCodeForm from '@/components/auth/MfaCodeForm';

type Step = 'email' | 'code' | 'mfa' | 'password' | 'done';

const inputCls =
  'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:bg-white/10 outline-none text-sm transition-all';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const typedUsername = email.trim().length > 0 && !email.includes('@');

  const sendCode = async () => {
    if (busy) return;
    if (!isValidRecoveryEmail(email)) {
      setError(t(typedUsername ? 'security.forgot_no_email' : 'security.err_invalid_email'));
      return;
    }
    setBusy(true);
    setError('');
    const r = await requestPasswordReset(email);
    setBusy(false);
    if (!r.ok) {
      setError(t(securityErrorKey(r.error)));
      return;
    }
    setInfo(t('security.forgot_sent', { email: email.trim().toLowerCase() }));
    setStep('code');
  };

  const verifyCode = async () => {
    if (busy || !isValidEmailCode(code)) return;
    setBusy(true);
    setError('');
    const r = await verifyPasswordResetCode(email, code);
    setBusy(false);
    if (!r.ok) {
      setError(t(securityErrorKey(r.error)));
      return;
    }
    setInfo('');
    setStep(r.mfaRequired ? 'mfa' : 'password');
  };

  const savePassword = async () => {
    if (busy) return;
    if (!isValidPassword(password)) {
      setError(t('security.err_weak_password'));
      return;
    }
    if (password !== password2) {
      setError(t('security.password_mismatch'));
      return;
    }
    setBusy(true);
    setError('');
    const r = await setNewPassword(password);
    setBusy(false);
    if (!r.ok) {
      setError(t(securityErrorKey(r.error)));
      return;
    }
    setPassword('');
    setPassword2('');
    setStep('done');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-4">
      <div className="glass-strong w-full max-w-md p-5 sm:p-8">
        <button
          type="button"
          onClick={() => router.push('/login/')}
          className="text-sm text-muted-c hover:text-white bg-transparent border-0 p-0 mb-4"
        >
          {t('security.back_login')}
        </button>

        {step !== 'mfa' && (
          <div className="text-center mb-6">
            <h1 className="heading-lg">{t('security.forgot_title')}</h1>
            {step === 'email' && <p className="text-sm text-muted-c mt-2">{t('security.forgot_desc')}</p>}
          </div>
        )}

        {info && <div className="mb-4 text-[13px] text-sky-200 bg-sky-500/10 border border-sky-500/20 rounded-xl px-4 py-3">{info}</div>}

        {step === 'email' && (
          <div className="space-y-4">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void sendCode();
              }}
              placeholder="ornek@eposta.com"
              className={inputCls}
            />
            {typedUsername && <p className="text-[13px] text-amber-300">{t('security.forgot_no_email')}</p>}
            <button type="button" className="btn btn-primary w-full" disabled={busy || !email.trim()} onClick={() => void sendCode()}>
              {busy ? t('common.loading') : t('security.forgot_send')}
            </button>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={EMAIL_CODE_MAX}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, EMAIL_CODE_MAX))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void verifyCode();
              }}
              placeholder="123456"
              className={`${inputCls} text-center text-2xl tracking-[0.4em] font-mono`}
            />
            <button type="button" className="btn btn-primary w-full" disabled={busy || !isValidEmailCode(code)} onClick={() => void verifyCode()}>
              {busy ? t('common.loading') : t('security.forgot_verify')}
            </button>
            <button
              type="button"
              className="w-full text-[13px] text-muted-c hover:text-white bg-transparent border-0"
              disabled={busy}
              onClick={() => void sendCode()}
            >
              {t('security.resend')}
            </button>
          </div>
        )}

        {step === 'mfa' && <MfaCodeForm onVerified={() => setStep('password')} />}

        {step === 'password' && (
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm font-medium mb-1">{t('security.new_password')}</div>
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              <div className="text-xs text-muted-c mt-1">{t('security.password_hint')}</div>
            </label>
            <label className="block">
              <div className="text-sm font-medium mb-1">{t('security.new_password_confirm')}</div>
              <input
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void savePassword();
                }}
                className={inputCls}
              />
            </label>
            <button type="button" className="btn btn-primary w-full" disabled={busy || !password} onClick={() => void savePassword()}>
              {busy ? t('common.loading') : t('security.save_password')}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <div className="font-semibold">{t('security.password_saved')}</div>
            <button type="button" className="btn btn-primary w-full" onClick={() => router.replace('/')}>
              {t('security.continue_app')}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

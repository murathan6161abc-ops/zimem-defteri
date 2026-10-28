'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { isValidTotp, securityErrorKey, verifyLoginTotp } from '@/lib/accountSecurity';

// Girişte (normal giriş, admin girişi, şifre sıfırlama) istenen 2FA kodu.
export default function MfaCodeForm({
  onVerified,
  onCancel,
}: {
  onVerified: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!isValidTotp(code) || busy) return;
    setBusy(true);
    setError('');
    const r = await verifyLoginTotp(code);
    if (!r.ok) {
      setError(t(securityErrorKey(r.error)));
      setCode('');
      setBusy(false);
      return;
    }
    await onVerified();
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="heading-lg">{t('security.challenge_title')}</h2>
        <p className="text-sm text-muted-c mt-1">{t('security.challenge_desc')}</p>
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        placeholder="123456"
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 outline-none text-center text-2xl tracking-[0.4em] font-mono"
      />
      {error && (
        <div className="text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={!isValidTotp(code) || busy}
        onClick={() => void submit()}
      >
        {busy ? t('common.loading') : t('security.verify_btn')}
      </button>
      {onCancel && (
        <button
          type="button"
          className="w-full text-[13px] text-muted-c hover:text-white bg-transparent border-0"
          onClick={() => void onCancel()}
        >
          {t('security.challenge_cancel')}
        </button>
      )}
    </div>
  );
}

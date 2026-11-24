'use client';
// Esnaf: havale için IBAN. İsteğe bağlı; yalnızca borcu üstlenen kişiye gösterilir.
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { getCurrentUserId } from '@/lib/auth';
import {
  deleteMyPaymentInfo,
  fetchMyPaymentInfo,
  formatIban,
  isValidTrIban,
  saveMyPaymentInfo,
  type PaymentInfo,
} from '@/lib/pledges';

export default function PaymentInfoCard() {
  const { t } = useI18n();
  const [available, setAvailable] = useState(false);
  const [saved, setSaved] = useState<PaymentInfo | null>(null);
  const [iban, setIban] = useState('');
  const [holder, setHolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void fetchMyPaymentInfo().then(({ available: a, info }) => {
      setAvailable(a);
      setSaved(info);
      if (info) {
        setIban(formatIban(info.iban));
        setHolder(info.accountHolder);
      }
    });
  }, []);

  if (!available) return null;

  const save = async () => {
    if (!isValidTrIban(iban)) {
      setMessage({ ok: false, text: t('realpay.m_iban_invalid') });
      return;
    }
    if (holder.trim().length < 2) {
      setMessage({ ok: false, text: t('realpay.m_holder_invalid') });
      return;
    }
    setBusy(true);
    const ok = await saveMyPaymentInfo(getCurrentUserId(), { iban, accountHolder: holder });
    setBusy(false);
    if (ok) {
      setSaved({ iban, accountHolder: holder.trim() });
      setIban(formatIban(iban));
    }
    setMessage({ ok, text: t(ok ? 'realpay.m_saved' : 'realpay.m_save_failed') });
  };

  const remove = async () => {
    if (!confirm(t('realpay.m_remove_confirm'))) return;
    setBusy(true);
    const ok = await deleteMyPaymentInfo(getCurrentUserId());
    setBusy(false);
    if (ok) {
      setSaved(null);
      setIban('');
      setHolder('');
      setMessage(null);
    } else {
      setMessage({ ok: false, text: t('realpay.m_save_failed') });
    }
  };

  return (
    <details className="glass p-4 mb-6" open={!saved}>
      <summary className="font-semibold cursor-pointer">
        🏦 {t('realpay.m_iban_title')}
        {saved && <span className="text-xs font-normal text-emerald-300 ms-2">✔ {formatIban(saved.iban).slice(0, 9)}…</span>}
      </summary>
      <p className="text-xs text-muted-c mt-2 mb-3">{t('realpay.m_iban_desc')}</p>
      <div className="grid gap-2">
        <input
          value={iban}
          onChange={(e) => {
            setIban(e.target.value.toUpperCase());
            setMessage(null);
          }}
          placeholder={t('realpay.m_iban_placeholder')}
          aria-label={t('realpay.iban_label')}
          autoComplete="off"
          inputMode="text"
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-amber-400/50"
        />
        <input
          value={holder}
          onChange={(e) => {
            setHolder(e.target.value);
            setMessage(null);
          }}
          placeholder={t('realpay.m_holder_placeholder')}
          aria-label={t('realpay.holder_label')}
          maxLength={80}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/50"
        />
      </div>
      {message && (
        <div className={`text-xs mt-2 ${message.ok ? 'text-emerald-300' : 'text-rose-300'}`} role="status">
          {message.text}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button type="button" className="btn btn-primary !text-[13px]" disabled={busy} onClick={() => void save()}>
          {t('realpay.m_save')}
        </button>
        {saved && (
          <button type="button" className="btn !text-[13px]" disabled={busy} onClick={() => void remove()}>
            {t('realpay.m_remove')}
          </button>
        )}
      </div>
    </details>
  );
}

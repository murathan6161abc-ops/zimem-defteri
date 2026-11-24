'use client';
// Muhtar onaylı borç için gerçek ödeme. Para uygulamadan geçmez: kullanıcı bir ödeme
// kodu alır, parayı dükkânda ya da esnafın IBAN'ına doğrudan öder; esnaf onaylayınca
// borç kapanır. Araştırma anketleri bu akışta sorulmaz.
import { useState } from 'react';
import ModalShell from './ModalShell';
import type { Debt } from '@/types';
import { useI18n } from '@/lib/i18n';
import { formatTL, parsePartialAmount } from '@/lib/debts';
import { createPledge, formatIban, type Pledge, type PledgeFailure, type PledgeMethod } from '@/lib/pledges';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useZimemStore } from '@/store/useZimemStore';

const FAILURE_KEY: Record<PledgeFailure, string> = {
  adult_only: 'realpay.err_adult_only',
  not_payable: 'realpay.err_not_payable',
  own_debt: 'realpay.err_own_debt',
  no_iban: 'realpay.err_no_iban',
  too_many_pending: 'realpay.err_too_many',
  exceeds: 'realpay.err_exceeds',
  unavailable: 'realpay.err_unavailable',
  error: 'realpay.err_generic',
};

export function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-muted-c shrink-0"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? t('realpay.copied') : t('realpay.copy')}
    </button>
  );
}

/** Ödeme kodu + nasıl ödeneceği. Ödemelerim listesinde de kullanılır. */
export function PledgeInstructions({ pledge, merchantFallback }: { pledge: Pledge; merchantFallback?: string }) {
  const { t, locale } = useI18n();
  const amount = formatTL(pledge.amount, locale);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-center">
        <div className="text-xs text-muted-c">{t('realpay.code_label')}</div>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-2xl font-extrabold tracking-widest text-amber-200 tabular-nums">{pledge.code}</span>
          <CopyButton text={pledge.code} />
        </div>
      </div>
      <p className="text-sm">
        {pledge.method === 'havale'
          ? t('realpay.done_havale', { amount })
          : pledge.merchantName || merchantFallback
            ? t('realpay.done_dukkan', { amount, merchant: pledge.merchantName || merchantFallback || '' })
            : t('realpay.done_dukkan_noname', { amount })}
      </p>
      {pledge.method === 'havale' && pledge.iban && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] text-muted-c">{t('realpay.iban_label')}</div>
              <div className="font-mono text-[13px] break-all">{formatIban(pledge.iban)}</div>
            </div>
            <CopyButton text={pledge.iban} />
          </div>
          {pledge.accountHolder && (
            <div>
              <div className="text-[11px] text-muted-c">{t('realpay.holder_label')}</div>
              <div>{pledge.accountHolder}</div>
            </div>
          )}
        </div>
      )}
      {pledge.method === 'havale' && !pledge.sentAt && (
        <p className="text-xs text-sky-200/90">{t('realpay.havale_hint')}</p>
      )}
    </div>
  );
}

export default function RealPaymentModal({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const upsertMyPledge = useZimemStore((s) => s.upsertMyPledge);
  const merchantName = (debt as { addedBy?: string } | null)?.addedBy;

  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [partialValue, setPartialValue] = useState('');
  const [method, setMethod] = useState<PledgeMethod>('dukkan');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pledge, setPledge] = useState<Pledge | null>(null);

  if (!debt) return null;
  const demo = !isSupabaseConfigured();

  const reset = () => {
    setMode('full');
    setPartialValue('');
    setMethod('dukkan');
    setAck(false);
    setError('');
    setPledge(null);
  };
  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (busy) return;
    let amount = debt.amount;
    if (mode === 'partial') {
      const parsed = parsePartialAmount(partialValue, debt.amount);
      if (parsed === null) {
        setError(t('realpay.amount_invalid', { max: debt.amount }));
        return;
      }
      amount = parsed;
    }
    setBusy(true);
    setError('');
    const result = await createPledge({ id: debt.id, title: debt.title }, amount, method);
    setBusy(false);
    if (!result.ok) {
      if (result.reason === 'exceeds' && !result.available) setError(t('realpay.err_exceeds_none'));
      else setError(t(FAILURE_KEY[result.reason], { max: formatTL(result.available ?? 0, locale) }));
      return;
    }
    const created = { ...result.pledge, merchantName: result.pledge.merchantName || merchantName };
    upsertMyPledge(created);
    setPledge(created);
  };

  return (
    <ModalShell open onClose={handleClose} title={pledge ? t('realpay.done_title') : t('realpay.title')}>
      {pledge ? (
        <div className="space-y-4">
          <PledgeInstructions pledge={pledge} merchantFallback={merchantName} />
          <p className="text-xs text-muted-c">{t('realpay.expires_note')}</p>
          {demo && <p className="text-xs text-amber-200/80">{t('realpay.demo_note')}</p>}
          <button type="button" className="btn btn-primary w-full" onClick={handleClose}>
            {t('realpay.close')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] font-semibold text-emerald-300 mb-1">{t('realpay.badge_verified')}</div>
            <div className="text-sm font-semibold">{debt.title}</div>
            <div className="text-xs text-muted-c mt-0.5">{debt.description}</div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-c">{t('debt.amount')}</span>
              <span className="text-2xl font-extrabold text-amber-200 tabular-nums">{formatTL(debt.amount, locale)}</span>
            </div>
          </div>

          <p className="text-xs text-muted-c">{t('realpay.intro')}</p>

          <fieldset>
            <legend className="text-sm font-semibold mb-2">{t('realpay.amount_label')}</legend>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                aria-pressed={mode === 'full'}
                onClick={() => setMode('full')}
                className={`tab-btn ${mode === 'full' ? 'active' : ''}`}
              >
                {t('realpay.full', { amount: formatTL(debt.amount, locale) })}
              </button>
              {debt.amount > 1 && (
                <button
                  type="button"
                  aria-pressed={mode === 'partial'}
                  onClick={() => setMode('partial')}
                  className={`tab-btn ${mode === 'partial' ? 'active' : ''}`}
                >
                  {t('realpay.partial')}
                </button>
              )}
            </div>
            {mode === 'partial' && (
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                max={debt.amount}
                value={partialValue}
                onChange={(e) => {
                  setPartialValue(e.target.value);
                  if (error) setError('');
                }}
                placeholder={`1-${debt.amount} ₺`}
                aria-label={t('realpay.partial')}
                className="mt-2 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-right outline-none focus:border-amber-400/50"
              />
            )}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold mb-2">{t('realpay.method_label')}</legend>
            <div className="grid gap-2">
              {(['dukkan', 'havale'] as const).map((m) => (
                <label
                  key={m}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    method === m ? 'border-amber-400/50 bg-amber-400/10' : 'border-white/10 bg-white/5'
                  } ${m === 'havale' && demo ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="realpay-method"
                    value={m}
                    checked={method === m}
                    disabled={m === 'havale' && demo}
                    onChange={() => {
                      setMethod(m);
                      if (error) setError('');
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {m === 'dukkan' ? '🏪 ' : '🏦 '}
                      {t(m === 'dukkan' ? 'realpay.method_dukkan' : 'realpay.method_havale')}
                    </span>
                    <span className="block text-xs text-muted-c">
                      {t(m === 'dukkan' ? 'realpay.method_dukkan_desc' : 'realpay.method_havale_desc')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
            <span>{t('realpay.ack')}</span>
          </label>

          {demo && <p className="text-xs text-amber-200/80">{t('realpay.demo_note')}</p>}

          {error && (
            <div className="text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" className="btn flex-1" onClick={handleClose} disabled={busy}>
              {t('common.give_up')}
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={() => void handleSubmit()}
              disabled={busy || !ack}
            >
              {busy ? t('realpay.submitting') : t('realpay.submit')}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

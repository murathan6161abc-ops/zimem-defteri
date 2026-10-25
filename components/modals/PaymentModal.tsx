'use client';
import { useState } from 'react';
import ModalShell from './ModalShell';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { formatTL } from '@/lib/debts';

export default function PaymentModal({ open }: { open: boolean }) {
  const confirmPayment = useZimemStore((s) => s.confirmPayment);
  const closeModal = useZimemStore((s) => s.closeModal);
  const debt = useZimemStore((s) => s.activeDebt);
  const partialAmount = useZimemStore((s) => s.activePayAmount);
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!debt) return null;
  const isPartial = partialAmount !== null;
  const payAmount = partialAmount ?? debt.amount;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const outcome = await confirmPayment();
    setBusy(false);
    // 'gone' durumunda akış kapanır ve kullanıcıya bildirim gösterilir.
    if (outcome === 'error') setError(t('payment.error'));
  };

  const handleClose = () => {
    if (busy) return;
    setError('');
    closeModal();
  };

  return (
    <ModalShell open={open} onClose={handleClose} title={t('payment.title')}>
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">{debt.title}</div>
          <div className="text-xs text-muted-c mt-0.5">{debt.description}</div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-c">{t('debt.amount')}</span>
            <span className="text-2xl font-extrabold text-amber-200 tabular-nums">{formatTL(payAmount, locale)}</span>
          </div>
        </div>

        <p className="text-sm">
          {isPartial
            ? t('payment.partial_desc', {
                amount: formatTL(payAmount, locale),
                remaining: formatTL(debt.amount - payAmount, locale),
              })
            : t('payment.full_desc', { amount: formatTL(debt.amount, locale) })}
        </p>
        <p className="text-xs text-muted-c">{t('payment.note')}</p>

        {error && (
          <div className="text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" role="alert">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn flex-1" onClick={handleClose} disabled={busy}>
            {t('common.give_up')}
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? t('payment.saving') : isPartial ? t('payment.confirm_partial') : t('payment.confirm_full')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

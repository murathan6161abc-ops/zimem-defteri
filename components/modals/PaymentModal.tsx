'use client';
import { useEffect } from 'react';
import ModalShell from './ModalShell';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';

export default function PaymentModal({ open }: { open: boolean }) {
  const confirmPayment = useZimemStore((s) => s.confirmPayment);
  const activeDebt = useZimemStore((s) =>
    s.openDebts.find((d) => d.id === s.activeDebtId),
  );
  const activePayAmount = useZimemStore((s) => s.activePayAmount);
  const { t } = useI18n();

  // Kutlama anı artık kullanıcının dokunuşuyla ilerler (tatmin edici bir beat).
  // Yine de güvenlik için: kullanıcı uzun süre dokunmazsa akış tıkanmasın.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => confirmPayment(), 8000);
    return () => clearTimeout(timer);
  }, [open, confirmPayment]);

  // Kısmi ödeme mi?
  const isPartial = activePayAmount !== null && activeDebt && activePayAmount < activeDebt.amount;
  const paidAmount = activePayAmount ?? activeDebt?.amount ?? 0;

  return (
    <ModalShell open={open}>
      <div className="text-center py-4">
        <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-5xl shadow-lg shadow-emerald-500/30 animate-pulse">
          {isPartial ? '🤲' : '✓'}
        </div>
        <h3 className="heading-lg mb-1">
          {isPartial ? t('payment.partial_done') : t('payment.full_done')}
        </h3>
        <p className="text-sm text-muted-c mb-2">
          {activeDebt
            ? `${activeDebt.title} · ${paidAmount} ₺ ${isPartial ? t('payment.contribution') : ''}`
            : ''}
        </p>
        {isPartial && activeDebt && (
          <p className="text-xs text-emerald-300 mb-3">
            {t('payment.remaining', { amount: activeDebt.amount - paidAmount })}
          </p>
        )}
        <p className="text-xs text-muted-c mb-5">
          {t('payment.next_question')}
        </p>
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => confirmPayment()}
          autoFocus
        >
          {t('payment.cta')} →
        </button>
      </div>
    </ModalShell>
  );
}

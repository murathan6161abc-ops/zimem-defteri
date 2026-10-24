'use client';
import { memo, useState } from 'react';
import type { Debt } from '@/types';
import { CATEGORY_META, parsePartialAmount } from '@/lib/debts';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';

const URGENCY_KEY = { 1: 'debt.low', 2: 'debt.medium', 3: 'debt.high' } as const;

function DebtCard({
  debt,
  onSelect,
}: {
  debt: Debt;
  onSelect: (id: string, partialAmount?: number | null) => void;
}) {
  const { t } = useI18n();
  const meta = CATEGORY_META[debt.category];
  const partialPaid = useZimemStore((s) => s.partialPayments[debt.id] || 0);
  const originalTotal = debt.amount + partialPaid; // başlangıçtaki tutar
  const progressPct =
    partialPaid > 0 ? Math.min(99, Math.round((partialPaid / originalTotal) * 100)) : 0;

  const [partialOpen, setPartialOpen] = useState(false);
  const [partialValue, setPartialValue] = useState('');
  const [partialError, setPartialError] = useState('');

  const handleFullPay = () => onSelect(debt.id, null);

  const handlePartialSubmit = () => {
    const amount = parsePartialAmount(partialValue, debt.amount);
    if (amount === null) {
      // Native alert yerine satır içi hata — APK'da kesintisiz, erişilebilir UX
      setPartialError(t('debt.partial_error', { max: debt.amount }));
      return;
    }
    setPartialError('');
    onSelect(debt.id, amount);
    setPartialOpen(false);
    setPartialValue('');
  };

  // Önerilen kısmi tutarlar — yuvarlak tutarlarda (örn. 100₺) yarısı 50'ye
  // denk gelip tekrar edebilir; Set ile yinelenenleri ayıkla.
  const suggestions = [...new Set([50, 100, Math.floor(debt.amount / 2)])].filter(
    (v) => v > 0 && v < debt.amount,
  );

  return (
    <article className="debt-card !cursor-default" style={{ display: 'block' }}>
      {/* Üst satır: tam kart yapısı */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{
            background: `${meta.color}22`,
            border: `1px solid ${meta.color}55`,
          }}
        >
          {debt.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`category-chip cat-${debt.category}`}>
              {meta.emoji} {t(`debt.cat_${debt.category}`)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-c">
              <span className={`urgency-dot urgency-${debt.urgency}`} />
              {t(URGENCY_KEY[debt.urgency])} {t('debt.urgency_suffix')}
            </span>
          </div>
          <div className="font-semibold text-[15px] truncate">{debt.title}</div>
          <div className="text-xs text-muted-c truncate">{debt.description}</div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-bold text-lg text-amber-200">{debt.amount} ₺</div>
          {progressPct > 0 && (
            <div className="text-[10px] text-emerald-300 font-medium">%{progressPct} {t('debt.paid_label')}</div>
          )}
        </div>
      </div>

      {/* Kısmi ödeme ilerleme çubuğu */}
      {progressPct > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Aksiyon butonları */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleFullPay}
          className="btn-primary-c flex-1 sm:flex-none !text-[13px] !px-4 !py-2"
        >
          💚 {t('debt.full_pay')}
        </button>

        <button
          type="button"
          onClick={() => setPartialOpen((v) => !v)}
          className="text-[12px] px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-muted-c"
          aria-expanded={partialOpen}
        >
          🤲 {t('debt.partial_pay')}
        </button>
      </div>

      {/* Kısmi katkı paneli */}
      {partialOpen && (
        <div className="mt-3 p-3 rounded-xl bg-white/5 border border-amber-500/20">
          <div className="text-[11px] text-muted-c mb-2">
            {t('debt.partial_hint')}
          </div>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {suggestions.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPartialValue(String(v))}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-muted-c"
              >
                {v} ₺
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              max={debt.amount}
              value={partialValue}
              onChange={(e) => {
                setPartialValue(e.target.value);
                if (partialError) setPartialError('');
              }}
              placeholder={`1-${debt.amount} ₺`}
              className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-right outline-none focus:border-amber-400/50"
            />
            <button
              type="button"
              onClick={handlePartialSubmit}
              className="bg-gradient-to-br from-amber-500 to-amber-600 text-black font-bold text-sm px-4 py-2 rounded-lg hover:scale-105 transition-transform"
            >
              ✓ {t('debt.confirm')}
            </button>
          </div>

          {partialError && (
            <div className="text-[11px] text-rose-300 mt-2" role="alert">
              {partialError}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// Liste yeniden render olduğunda değişmeyen kartlar yeniden çizilmesin
export default memo(DebtCard);

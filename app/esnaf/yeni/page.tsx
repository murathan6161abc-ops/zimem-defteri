'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { DEBT_KINDS, KIND_META, MAX_DEBT_AMOUNT } from '@/lib/debts';
import { parseAmount } from '@/lib/ledgerParse';
import type { DebtKind } from '@/types';

const URGENCY_KEY = { 1: 'debt.low', 2: 'debt.medium', 3: 'debt.high' } as const;

export default function NewMerchantDebtPage() {
  const router = useRouter();
  const addDebt = useZimemStore((s) => s.addMerchantDebt);
  const { t } = useI18n();

  const [kind, setKind] = useState<DebtKind>('gida');
  const [icon, setIcon] = useState<string>(KIND_META.gida.emoji);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [urgency, setUrgency] = useState<1 | 2 | 3>(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Türkçe yazım: "1.250" bin iki yüz elli, "12,50" on iki buçuk (taramayla aynı kural).
  const amountNum = parseAmount(amount);
  const amountInRange = amountNum >= 1 && amountNum <= MAX_DEBT_AMOUNT;
  // Başlık isteğe bağlı: boşsa türe göre hazır başlık kullanılır.
  const finalTitle = title.trim().length >= 3 ? title.trim() : t(`debt.kind_title_${kind}`);
  const canSubmit =
    description.trim().length >= 3 &&
    amountInRange &&
    !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    const saved = await addDebt({
      category: KIND_META[kind].group,
      kind,
      icon,
      title: finalTitle,
      description: description.trim(),
      amount: amountNum,
      urgency,
    });
    if (!saved) {
      // Kayıt hiçbir yere yazılmadı; form dolu kalır, esnaf tekrar dener.
      setError(t('merchant.save_failed'));
      setBusy(false);
      return;
    }
    router.push('/esnaf/');
  };

  return (
    <div className="pt-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <Link href="/esnaf" className="text-sm text-muted-c hover:text-white">
          {t('merchant.back_to_book')}
        </Link>
        <h1 className="heading-xl mt-2">{t('merchant.new_record')}</h1>
        <p className="text-sm text-muted-c">
          {t('merchant.new_record_desc')}
        </p>
      </div>

      <div className="glass p-6 space-y-5">
        <section>
          <div className="section-title">{t('merchant.step_category')}</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {DEBT_KINDS.map((k) => {
              const meta = KIND_META[k];
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setKind(k);
                    setIcon(meta.emoji);
                  }}
                  className="flex flex-col items-center justify-center gap-1 min-h-[76px] px-1 py-2.5 rounded-2xl border text-center transition-all"
                  style={
                    active
                      ? { borderColor: meta.color, background: `${meta.color}2e`, boxShadow: `0 0 0 1px ${meta.color}66` }
                      : { borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }
                  }
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {meta.emoji}
                  </span>
                  <span className={`text-xs leading-tight ${active ? 'font-semibold text-white' : 'text-muted-c'}`}>
                    {t(`debt.kind_${k}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="text-xs text-muted-c mb-2">{t('debt.icon_label')}</div>
          <div className="flex flex-wrap gap-1.5">
            {KIND_META[kind].icons.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={icon === i}
                onClick={() => setIcon(i)}
                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all ${
                  icon === i ? 'border-purple-400 bg-purple-500/25 scale-110' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-sm font-medium mb-1">{t('merchant.step_amount')}</div>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="180"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:bg-white/10 outline-none text-sm transition-all"
            />
            {amount && !amountInRange && (
              <div className="text-[11px] text-rose-300 mt-1" role="alert">
                {t('merchant.amount_range')}
              </div>
            )}
          </label>
          <div>
            <div className="text-sm font-medium mb-1">{t('merchant.step_urgency')}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {([1, 2, 3] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`px-2 py-3 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
                    urgency === u
                      ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                      : 'border-white/10 bg-white/5 text-muted-c hover:bg-white/10'
                  }`}
                >
                  <span className={`urgency-dot urgency-${u}`} />
                  <span>{t(URGENCY_KEY[u])}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <label className="block">
            <div className="text-sm font-medium mb-1">{t('merchant.step_desc')}</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('merchant.desc_ph')}
              rows={3}
              maxLength={180}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:bg-white/10 outline-none text-sm transition-all resize-none"
            />
            <div className="text-xs text-muted-c text-right">
              {description.length}/180
            </div>
          </label>
        </section>

        <section>
          <label className="block">
            <div className="text-sm font-medium mb-1">{t('merchant.step_title')}</div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(`debt.kind_ph_${kind}`)}
              maxLength={48}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:bg-white/10 outline-none text-sm transition-all"
            />
          </label>
        </section>
        {error && (
          <div
            className="text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Link href="/esnaf" className="btn flex-1 text-center">
            {t('common.give_up')}
          </Link>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {busy ? t('common.loading') : t('merchant.add_to_book')}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-c text-center mt-4 opacity-70">
        {t('merchant.new_footer')}
      </p>
    </div>
  );
}

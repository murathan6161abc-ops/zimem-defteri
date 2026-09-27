'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { CATEGORY_ICONS, CATEGORY_META } from '@/lib/debts';
import type { Category } from '@/types';

const URGENCY_KEY = { 1: 'debt.low', 2: 'debt.medium', 3: 'debt.high' } as const;

export default function NewMerchantDebtPage() {
  const router = useRouter();
  const addDebt = useZimemStore((s) => s.addMerchantDebt);
  const { t } = useI18n();

  const [category, setCategory] = useState<Category>('gida');
  const [icon, setIcon] = useState<string>('🍞');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [urgency, setUrgency] = useState<1 | 2 | 3>(2);

  const amountNum = Number(amount.replace(/,/g, '.'));
  const canSubmit =
    title.trim().length >= 3 &&
    description.trim().length >= 3 &&
    !Number.isNaN(amountNum) &&
    amountNum > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    addDebt({
      category,
      icon,
      title: title.trim(),
      description: description.trim(),
      amount: Math.round(amountNum),
      urgency,
    });
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(CATEGORY_META) as Category[]).map((c) => {
              const meta = CATEGORY_META[c];
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategory(c);
                    setIcon(CATEGORY_ICONS[c][0]);
                  }}
                  className={`emotion-card ${active ? 'selected' : ''}`}
                  style={
                    active
                      ? { borderColor: meta.color, background: `${meta.color}22` }
                      : undefined
                  }
                >
                  <div className="emotion-emoji">{meta.emoji}</div>
                  <div className="emotion-label">{t(`debt.cat_${c}`)}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="section-title">{t('merchant.step_icon')}</div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORY_ICONS[category].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border transition-all ${
                  icon === i
                    ? 'border-purple-400 bg-purple-500/20'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="block">
            <div className="text-sm font-medium mb-1">{t('merchant.step_title')}</div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(`merchant.title_ph_${category}`)}
              maxLength={48}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:bg-white/10 outline-none text-sm transition-all"
            />
          </label>
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
            <div className="text-[11px] text-muted-c text-right">
              {description.length}/180
            </div>
          </label>
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

        <div className="flex gap-2 pt-2">
          <Link href="/esnaf" className="btn flex-1 text-center">
            {t('common.give_up')}
          </Link>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {t('merchant.add_to_book')}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-c text-center mt-4 opacity-70">
        {t('merchant.new_footer')}
      </p>
    </div>
  );
}

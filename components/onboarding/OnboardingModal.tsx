'use client';
// İlk girişte bir kez gösterilen kısa tanıtım. Gösterildiği bilgisi localStorage'da tutulur.
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';

const STORAGE_KEY = 'd-zimem-onboarding-shown-v1';

const SLIDES_CITIZEN = ['c1', 'c2', 'c3'];
const SLIDES_MERCHANT = ['m1', 'm2', 'm3'];

export default function OnboardingModal() {
  const profile = useZimemStore((s) => s.profile);
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!profile) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    setOpen(true);
  }, [profile]);

  if (!open || !profile) return null;

  const slides = profile.role === 'esnaf' ? SLIDES_MERCHANT : SLIDES_CITIZEN;
  const slide = slides[step];
  const isLast = step === slides.length - 1;

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-md p-6" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted-c tabular-nums">
            {step + 1} / {slides.length}
          </span>
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/20'}`}
              />
            ))}
          </div>
        </div>

        <h2 className="heading-xl mb-2">{t(`onboarding.${slide}_title`)}</h2>
        <p className="text-sm text-muted-c leading-relaxed mb-6">{t(`onboarding.${slide}_desc`)}</p>

        <div className="flex gap-2">
          <button type="button" onClick={handleClose} className="btn flex-1 !text-[13px]">
            {t('onboarding.skip')}
          </button>
          <button
            type="button"
            onClick={() => (isLast ? handleClose() : setStep(step + 1))}
            className="btn btn-primary flex-[2] !text-[13px]"
          >
            {isLast ? t('onboarding.start') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

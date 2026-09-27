'use client';
// ============================================================
// İlk açılışta gösterilen "nasıl çalışır?" eğitici modal
// 3 kart: Bul · Kapat · Etki gör
// localStorage'da bir kez gösterilmiş bayrağı tutar.
// ============================================================
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';

const STORAGE_KEY = 'd-zimem-onboarding-shown-v1';

interface Slide {
  emoji: string;
  titleKey: string;
  descKey: string;
}

const SLIDES_CITIZEN: Slide[] = [
  { emoji: '👀', titleKey: 'onboarding.c1_title', descKey: 'onboarding.c1_desc' },
  { emoji: '💚', titleKey: 'onboarding.c2_title', descKey: 'onboarding.c2_desc' },
  { emoji: '🌱', titleKey: 'onboarding.c3_title', descKey: 'onboarding.c3_desc' },
];

const SLIDES_MERCHANT: Slide[] = [
  { emoji: '🏪', titleKey: 'onboarding.m1_title', descKey: 'onboarding.m1_desc' },
  { emoji: '➕', titleKey: 'onboarding.m2_title', descKey: 'onboarding.m2_desc' },
  { emoji: '✨', titleKey: 'onboarding.m3_title', descKey: 'onboarding.m3_desc' },
];

export default function OnboardingModal() {
  const profile = useZimemStore((s) => s.profile);
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Profil oluşturulduktan sonra ilk kez göster
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
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-md p-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Slayt göstergeci */}
          <div className="flex justify-center gap-1.5 mb-5">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>

          {/* Slayt içeriği */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">{slide.emoji}</div>
            <h2 className="heading-xl mb-2">{t(slide.titleKey)}</h2>
            <p className="text-sm text-muted-c leading-relaxed">{t(slide.descKey)}</p>
          </div>

          {/* Aksiyon butonları */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn flex-1 !text-[13px]"
            >
              {t('onboarding.skip')}
            </button>
            <button
              type="button"
              onClick={() => (isLast ? handleClose() : setStep(step + 1))}
              className="btn btn-primary flex-[2] !text-[13px]"
            >
              {isLast ? t('onboarding.start') : t('onboarding.next', { step: step + 1, total: slides.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

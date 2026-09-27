'use client';
import { useEffect, useState } from 'react';
import ModalShell from './ModalShell';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { getLevelInfo } from '@/lib/levels';
import Confetti from '@/components/ui/Confetti';

const MSG_COUNT = 5;

export default function ResultModal({ open }: { open: boolean }) {
  const closeModal = useZimemStore((s) => s.closeModal);
  const lastResult = useZimemStore((s) => s.lastResult);
  const xp = useZimemStore((s) => s.xp);
  const { t } = useI18n();
  const [showConfetti, setShowConfetti] = useState(false);
  const [msgIdx, setMsgIdx] = useState(1);

  // Modal her açıldığında yeni bir mesaj seç. Math.random'ı doğrudan render
  // içinde değil effect içinde çağırmak React saf-render kuralına uygundur.
  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      setMsgIdx(Math.floor(Math.random() * MSG_COUNT) + 1);
      const timer = setTimeout(() => setShowConfetti(false), 2800);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!lastResult) return null;
  const { current } = getLevelInfo(xp);
  const newAchievements = lastResult.newAchievements
    .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
    .filter(Boolean) as { id: string; nameKey: string; descKey: string; emoji: string }[];

  return (
    <>
      {showConfetti && <Confetti />}
      <ModalShell open={open} onClose={closeModal}>
        <div className="text-center">
          <div className="text-6xl mb-3">{current.emoji}</div>
          <div className="section-title">{t('result.earned')}</div>
          <div className="heading-xl mb-1 text-amber-300">+{lastResult.xp} XP</div>
          <div className="text-sm text-muted-c mb-5">
            {t('result.current_level')} <span className="text-white font-semibold">{t(`levels.${current.key}`)}</span>
          </div>

          {newAchievements.length > 0 && (
            <div className="mb-5">
              <div className="section-title">{t('result.unlocked_achievements')}</div>
              <div className="grid gap-2">
                {newAchievements.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/30 rounded-2xl p-3"
                  >
                    <div className="text-3xl">{a.emoji}</div>
                    <div className="text-left">
                      <div className="font-bold text-amber-200">{t(a.nameKey)}</div>
                      <div className="text-xs text-muted-c">{t(a.descKey)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm italic text-muted-c mb-5">&ldquo;{t(`result.msg${msgIdx}`)}&rdquo;</p>

          <button type="button" className="btn btn-gold w-full" onClick={closeModal}>
            {t('result.continue')}
          </button>
        </div>
      </ModalShell>
    </>
  );
}

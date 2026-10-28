'use client';
import { useEffect, useState } from 'react';
import ModalShell from './ModalShell';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { ACHIEVEMENTS, type AchievementDef } from '@/lib/achievements';
import { getLevelInfo } from '@/lib/levels';
import { formatTL } from '@/lib/debts';
import Confetti from '@/components/ui/Confetti';
import AchievementBadge from '@/components/achievements/AchievementBadge';
import { GAMIFICATION } from '@/lib/research';

export default function ResultModal({ open }: { open: boolean }) {
  const closeModal = useZimemStore((s) => s.closeModal);
  const lastResult = useZimemStore((s) => s.lastResult);
  const xp = useZimemStore((s) => s.xp);
  const { t, locale } = useI18n();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 2800);
    return () => clearTimeout(timer);
  }, [open]);

  if (!lastResult) return null;
  const { current } = getLevelInfo(xp);
  const newAchievements = lastResult.newAchievements
    .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
    .filter((a): a is AchievementDef => !!a);

  return (
    <>
      {showConfetti && <Confetti />}
      <ModalShell open={open} onClose={closeModal}>
        <div className="text-center">
          {GAMIFICATION && (
            <>
              <div className="section-title">{t('result.earned')}</div>
              <div className="heading-xl mb-1 text-amber-300 tabular-nums">+{lastResult.xp} XP</div>
              <div className="text-sm text-muted-c mb-4">
                {t('result.current_level')} <span className="text-white font-semibold">{t(`levels.${current.key}`)}</span>
              </div>
            </>
          )}

          <p className="text-sm mb-5">
            {lastResult.remaining > 0
              ? t('result.remaining_note', { amount: formatTL(lastResult.remaining, locale) })
              : t('result.closed_note')}
          </p>

          {GAMIFICATION && newAchievements.length > 0 && (
            <div className="mb-5">
              <div className="section-title">{t('result.unlocked_achievements')}</div>
              <div className="grid gap-2">
                {newAchievements.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/30 rounded-2xl p-3"
                  >
                    <AchievementBadge mark={a.mark} earned className="shrink-0" />
                    <div className="text-left">
                      <div className="font-bold text-amber-200">{t(a.nameKey)}</div>
                      <div className="text-xs text-muted-c">{t(a.descKey)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="btn btn-gold w-full" onClick={closeModal}>
            {t('result.continue')}
          </button>
        </div>
      </ModalShell>
    </>
  );
}

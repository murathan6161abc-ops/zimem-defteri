'use client';
import { useEffect, useState } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { ACHIEVEMENTS } from '@/lib/achievements';
import AchievementBadge from './AchievementBadge';

export default function AchievementGrid() {
  const unlocked = useZimemStore((s) => s.unlockedAchievements);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const set = new Set(mounted ? unlocked : []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {ACHIEVEMENTS.map((a) => {
        const has = set.has(a.id);
        return (
          <div
            key={a.id}
            className={`glass p-4 text-center transition-all ${has ? 'border-amber-400/40 bg-amber-400/5' : 'opacity-60'}`}
          >
            <AchievementBadge mark={a.mark} earned={has} className="mx-auto mb-2" />
            <div className={`font-bold text-sm mb-0.5 ${has ? 'text-amber-200' : ''}`}>
              {t(a.nameKey)}
            </div>
            <div className="text-xs text-muted-c">{t(a.descKey)}</div>
            {!has && (
              <div className="text-[11px] mt-1 text-muted-c opacity-70">🔒 {t('ach.locked')}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

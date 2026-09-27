'use client';
import { useEffect, useState } from 'react';
import AchievementGrid from '@/components/achievements/AchievementGrid';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { ACHIEVEMENTS } from '@/lib/achievements';

export default function AchievementsPage() {
  const unlocked = useZimemStore((s) => s.unlockedAchievements);
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = mounted ? unlocked.length : 0;

  return (
    <div className="pt-6">
      <div className="mb-4">
        <h2 className="heading-lg">{t('ach.title')}</h2>
        <div className="text-sm text-muted-c" suppressHydrationWarning>
          {t('ach.unlocked_count', { n: count, total: ACHIEVEMENTS.length })}
        </div>
      </div>

      <AchievementGrid />
    </div>
  );
}

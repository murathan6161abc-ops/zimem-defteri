'use client';
import ScoreBoard from '@/components/layout/ScoreBoard';
import StatGrid from '@/components/layout/StatGrid';
import WeeklyXPChart from '@/components/charts/WeeklyXPChart';
import CategoryPie from '@/components/charts/CategoryPie';
import EmotionTrend from '@/components/charts/EmotionTrend';
import { useI18n } from '@/lib/i18n';

export default function StatsPage() {
  const { t } = useI18n();
  return (
    <div className="pt-6">
      <ScoreBoard />
      <StatGrid />
      <h2 className="heading-lg mb-3">{t('stats.title')}</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <WeeklyXPChart />
        <CategoryPie />
        <div className="md:col-span-2">
          <EmotionTrend />
        </div>
      </div>
    </div>
  );
}

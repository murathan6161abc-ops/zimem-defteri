'use client';
import { useI18n } from '@/lib/i18n';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="text-center text-xs text-muted-c py-6 opacity-70">
      {t('nav.footer')} · D-Zimem
    </footer>
  );
}

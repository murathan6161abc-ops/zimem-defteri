'use client';
import { useEffect } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import { useScanStore } from '@/store/useScanStore';

/**
 * Uygulama hangi sayfada açılırsa açılsın, yarım kalmış defter taramalarının
 * takibini sürdürür (uygulama kapanıp açıldıysa sonuç yine gelir).
 */
export default function ScanWatcher() {
  const role = useZimemStore((s) => s.profile?.role);
  const resume = useScanStore((s) => s.resume);
  useEffect(() => {
    if (role === 'esnaf') resume();
  }, [role, resume]);
  return null;
}

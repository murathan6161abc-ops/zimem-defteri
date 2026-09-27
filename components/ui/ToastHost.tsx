'use client';
import { useEffect } from 'react';
import { useZimemStore } from '@/store/useZimemStore';

export default function ToastHost() {
  const toasts = useZimemStore((s) => s.toasts);
  const dismiss = useZimemStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.id), 4500),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => dismiss(t.id)}>
          <div className="toast-emoji">{t.emoji}</div>
          <div className="flex-1">
            <div className="toast-title">{t.title}</div>
            {t.desc && <div className="toast-desc">{t.desc}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

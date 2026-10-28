'use client';
import { useEffect } from 'react';
import { useZimemStore } from '@/store/useZimemStore';

const TOAST_MS = 4500;

// Her bildirimin kendi zamanlayıcısı vardır; yeni bildirim gelince eskilerin süresi baştan başlamaz.
function Toast({ id, title, desc }: { id: string; title: string; desc?: string }) {
  const dismiss = useZimemStore((s) => s.dismissToast);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [id, dismiss]);

  return (
    <div className="toast" role="status" onClick={() => dismiss(id)}>
      <div className="flex-1">
        <div className="toast-title">{title}</div>
        {desc && <div className="toast-desc">{desc}</div>}
      </div>
    </div>
  );
}

export default function ToastHost() {
  const toasts = useZimemStore((s) => s.toasts);
  return (
    <div className="toast-wrap" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} id={t.id} title={t.title} desc={t.desc} />
      ))}
    </div>
  );
}

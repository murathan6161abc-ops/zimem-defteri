'use client';
import { ReactNode, useEffect } from 'react';

export default function ModalShell({
  open,
  onClose,
  children,
  title,
  subtitle,
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {title && (
          <header className="text-center mb-5">
            <h3 className="heading-lg mb-1">{title}</h3>
            {subtitle && <p className="text-sm text-muted-c">{subtitle}</p>}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

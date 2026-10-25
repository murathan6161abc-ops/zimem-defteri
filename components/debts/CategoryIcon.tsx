import type { Category } from '@/types';
import { CATEGORY_META } from '@/lib/debts';

// Çizgi ikonlar (24×24, stroke). Esnafın seçtiği bir ikon sunucuda tutulmadığı için
// ikon kategoriden gelir; böylece borç her cihazda aynı görünür.
const PATHS: Record<Category, string[]> = {
  // ekmek
  gida: [
    'M5 11a4 4 0 0 1 1-7.5C8 3 10 4 12 4s4-1 6-.5A4 4 0 0 1 19 11v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z',
    'M9 9v6',
    'M15 9v6',
  ],
  // açık kitap
  egitim: [
    'M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z',
    'M12 6.5v13',
  ],
  // ampul
  fatura: [
    'M9 18h6',
    'M10 21h4',
    'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  ],
  // ilaç kapsülü
  saglik: [
    'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z',
    'M7.5 10.5l6 6',
  ],
};

export default function CategoryIcon({ category, size = 48 }: { category: Category; size?: number }) {
  const color = CATEGORY_META[category].color;
  return (
    <div
      className="rounded-2xl flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: `${color}1f`, border: `1px solid ${color}55`, color }}
      aria-hidden
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[category].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </div>
  );
}

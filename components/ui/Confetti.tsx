'use client';
import { useEffect, useState } from 'react';

const COLORS = ['#fbbf24', '#a855f7', '#3b82f6', '#10b981', '#ec4899', '#f59e0b'];

export default function Confetti({ count = 60 }: { count?: number }) {
  const [pieces, setPieces] = useState<
    { left: number; color: string; delay: number; rotate: number }[]
  >([]);

  useEffect(() => {
    setPieces(
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.6,
        rotate: Math.random() * 360,
      })),
    );
  }, [count]);

  return (
    <div className="confetti-wrap">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

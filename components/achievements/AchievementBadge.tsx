export default function AchievementBadge({
  mark,
  earned,
  className = '',
}: {
  mark: string;
  earned: boolean;
  className?: string;
}) {
  return (
    <div
      className={`w-12 h-12 rounded-full grid place-items-center font-extrabold tabular-nums border-2 ${
        mark.length > 3 ? 'text-[11px]' : 'text-sm'
      } ${earned ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-white/15 text-muted-c'} ${className}`}
      aria-hidden
    >
      {mark}
    </div>
  );
}

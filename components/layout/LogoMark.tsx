export default function LogoMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-14 h-14 rounded-2xl text-3xl' : 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-lg sm:text-xl';
  return (
    <div className={`${box} bg-amber-400 text-[#1a1207] flex items-center justify-center font-black shrink-0`} aria-hidden>
      Z
    </div>
  );
}

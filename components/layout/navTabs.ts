// Ana menü sekmeleri — üst başlık (tablet/masaüstü) ve alt menü (telefon) ortak kullanır.
export type NavTab = { href: string; labelKey: string; shortKey: string; icon: string };

export const VATANDAS_TABS: NavTab[] = [
  { href: '/', labelKey: 'nav.zimem', shortKey: 'nav.zimem', icon: '📜' },
  { href: '/analiz', labelKey: 'nav.analysis', shortKey: 'nav.analysis', icon: '🧠' },
  { href: '/liderlik', labelKey: 'nav.leaderboard', shortKey: 'nav.leaderboard', icon: '🏆' },
  { href: '/history', labelKey: 'nav.history', shortKey: 'nav.history', icon: '🕰️' },
  { href: '/profil', labelKey: 'nav.profile', shortKey: 'nav.profile', icon: '👤' },
];

export const ESNAF_TABS: NavTab[] = [
  { href: '/esnaf', labelKey: 'nav.merchant_book', shortKey: 'nav.book_short', icon: '🏪' },
  { href: '/esnaf/tara', labelKey: 'scan.title', shortKey: 'nav.scan', icon: '📷' },
  { href: '/esnaf/yeni', labelKey: 'nav.add_debt', shortKey: 'nav.add_short', icon: '➕' },
  { href: '/profil', labelKey: 'nav.profile', shortKey: 'nav.profile', icon: '👤' },
];

// Menünün gösterilmediği sayfalar (giriş/kayıt akışı)
const NO_NAV_PREFIXES = ['/register', '/login', '/profil-tamamla', '/sifremi-unuttum', '/onam-formlari'];

/** "/esnaf/" → "/esnaf" (static export sondaki / ile çalışır) */
export function normalizePath(pathname: string | null): string {
  const p = pathname || '/';
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

export function isNavHidden(pathname: string | null): boolean {
  const p = normalizePath(pathname);
  return NO_NAV_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function isTabActive(pathname: string | null, href: string): boolean {
  return normalizePath(pathname) === href;
}

// Araştırma etiği yardımcıları: yaş grubu ve veli onamı kuralı.
// Doğum tarihi tutulmaz; yalnızca "18 yaş altı" / "18 yaş üstü" bilgisi saklanır.

export type AgeGroup = 'minor' | 'adult';

export function isAgeGroup(value: unknown): value is AgeGroup {
  return value === 'minor' || value === 'adult';
}

/**
 * Kayıt için yaş grubu seçilmiş olmalı; 18 yaş altı için ayrıca velinin imzalı
 * onam formunu verdiği beyan edilmelidir (şartname 4.2.8).
 */
export function consentComplete(ageGroup: AgeGroup | null, guardianConfirmed: boolean): boolean {
  if (ageGroup === 'adult') return true;
  return ageGroup === 'minor' && guardianConfirmed;
}

/**
 * Oyunlaştırma (XP, seviye, rozet, liderlik tablosu) açık mı? NEXT_PUBLIC_GAMIFICATION=off
 * ile derlenen sürümde gizlenir. Puanlar motivasyonu etkileyebileceği için araştırmada
 * karşılaştırma grubu ya da "araştırma modu" olarak kullanılabilir; hangi sürümden
 * geldiği anket kaydındaki app_version'dan anlaşılır (bkz. surveyAppVersion).
 */
export const GAMIFICATION = process.env.NEXT_PUBLIC_GAMIFICATION !== 'off';

/** Anket kaydına yazılan sürüm: oyunlaştırma kapalı derlemede "-oyunsuz" eki alır. */
export function surveyAppVersion(version: string): string {
  return GAMIFICATION ? version : `${version}-oyunsuz`;
}

/** Araştırma ekibinin iletişim e-postası (aydınlatma metninde gösterilir). */
export const RESEARCH_CONTACT = (process.env.NEXT_PUBLIC_RESEARCH_CONTACT_EMAIL || '').trim();

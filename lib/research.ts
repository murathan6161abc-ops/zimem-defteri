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

/** Araştırma ekibinin iletişim e-postası (aydınlatma metninde gösterilir). */
export const RESEARCH_CONTACT = (process.env.NEXT_PUBLIC_RESEARCH_CONTACT_EMAIL || '').trim();

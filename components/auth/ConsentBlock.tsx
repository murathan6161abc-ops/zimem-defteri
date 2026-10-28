'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { RESEARCH_CONTACT, type AgeGroup } from '@/lib/research';

// Aydınlatma metni + yaş grubu + (18 yaş altı için) veli onamı + gönüllü onam.
// Kayıt ve Google sonrası "profili tamamla" ekranında aynı blok kullanılır.
export default function ConsentBlock({
  ageGroup,
  onAgeGroup,
  guardian,
  onGuardian,
  consent,
  onConsent,
}: {
  ageGroup: AgeGroup | null;
  onAgeGroup: (value: AgeGroup) => void;
  guardian: boolean;
  onGuardian: (value: boolean) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const ageOption = (value: AgeGroup, label: string) => (
    <label
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer select-none text-[13px] ${
        ageGroup === value ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <input
        type="radio"
        name="age-group"
        checked={ageGroup === value}
        onChange={() => onAgeGroup(value)}
        className="w-4 h-4 shrink-0 accent-amber-400"
      />
      {label}
    </label>
  );

  return (
    <>
      <div className="mt-5">
        <div className="text-[13px] font-semibold mb-2">{t('register.age_title')}</div>
        <div className="space-y-2" role="radiogroup" aria-label={t('register.age_title')}>
          {ageOption('adult', t('register.age_adult'))}
          {ageOption('minor', t('register.age_minor'))}
        </div>
      </div>

      {ageGroup === 'minor' && (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={guardian}
              onChange={(e) => onGuardian(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0 accent-amber-400"
            />
            <span className="text-[13px] leading-relaxed">{t('register.guardian_checkbox')}</span>
          </label>
          <p className="mt-2 text-xs text-muted-c leading-relaxed">{t('register.guardian_hint')}</p>
        </div>
      )}

      {/* Aydınlatma metni + bilgilendirilmiş gönüllü onam (araştırma etiği / KVKK) */}
      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
          aria-expanded={open}
        >
          <span className="text-[13px] font-semibold flex items-center gap-2">
            🔒 {t('register.consent_title')}
          </span>
          <span className={`text-muted-c transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {open && (
          <div className="px-4 pb-4 text-xs text-muted-c leading-relaxed space-y-2 border-t border-white/5 pt-3">
            <p>{t('register.consent_p1')}</p>
            <p>{t('register.consent_p2')}</p>
            <p>{t('register.consent_p3')}</p>
            <p>{t('register.consent_p4')}</p>
            <p>{t('register.consent_p5')}</p>
            <p>{t('register.consent_p6')}</p>
            {RESEARCH_CONTACT && <p>{t('register.consent_contact', { contact: RESEARCH_CONTACT })}</p>}
          </div>
        )}
      </div>

      <label className="mt-3 flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
          className="mt-0.5 w-4 h-4 shrink-0 accent-amber-400"
        />
        <span className="text-[13px] text-muted-c leading-relaxed">{t('register.consent_checkbox')}</span>
      </label>
    </>
  );
}

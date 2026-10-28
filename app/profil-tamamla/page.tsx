'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import type { Role } from '@/types';
import ConsentBlock from '@/components/auth/ConsentBlock';
import { consentComplete, type AgeGroup } from '@/lib/research';
import LogoMark from '@/components/layout/LogoMark';

// Google ile ilk kez giren hesap: rol, takma ad ve araştırma onamı alınır.
// Google'ın paylaştığı gerçek ad kullanılmaz; kişi anonim bir takma ad seçer.
const inputCls =
  'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:bg-white/10 outline-none text-sm transition-all';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [consent, setConsent] = useState(false);
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [guardian, setGuardian] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Oturum yoksa (sayfaya doğrudan gelindiyse) girişe gönder.
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    void client.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login/');
    });
  }, [router]);

  const canSave =
    role !== null &&
    displayName.trim().length >= 2 &&
    (role !== 'esnaf' || shopName.trim().length >= 2) &&
    consent &&
    consentComplete(ageGroup, guardian) &&
    !busy;

  const save = async () => {
    const client = getSupabase();
    if (!client || !canSave || !role) return;
    setBusy(true);
    setError('');
    const now = new Date().toISOString();
    try {
      const { error: err } = await client.auth.updateUser({
        data: {
          role,
          displayName: displayName.trim(),
          shopName: role === 'esnaf' ? shopName.trim() : null,
          city: city.trim() || null,
          createdAt: now,
          consentAt: now,
          ageGroup,
          guardianConsentAt: ageGroup === 'minor' ? now : null,
          signupCompleted: true,
        },
      });
      if (err) throw err;
      // updateUser oturum anahtarını (JWT) yenilemez; veritabanı kuralları rolü
      // anahtardan okuduğu için (ör. esnafın defter taraması) hemen yenile.
      await client.auth.refreshSession();
      router.replace(role === 'esnaf' ? '/esnaf/' : '/');
    } catch {
      setError(t('auth.err_generic'));
      setBusy(false);
    }
  };

  const cancel = async () => {
    await signOut();
    router.replace('/login/');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-4">
      <div className="glass-strong w-full max-w-lg p-5 sm:p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <LogoMark size="lg" />
          </div>
          <h1 className="heading-lg">{t('complete.title')}</h1>
          <p className="text-sm text-muted-c mt-1">{t('complete.subtitle')}</p>
        </div>

        <div className="section-title text-center mb-3">{t('register.who_are_you')}</div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {(['vatandas', 'esnaf'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`emotion-card !p-4 ${role === r ? 'selected' : ''}`}
            >
              <div className="font-bold text-sm">{r === 'esnaf' ? t('register.merchant') : t('register.citizen')}</div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <label className="block">
            <div className="text-sm font-medium mb-1">{t('register.nickname_label')}</div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={role === 'esnaf' ? t('register.nickname_ph_merchant') : t('register.nickname_ph_citizen')}
              className={inputCls}
            />
            <div className="text-xs text-muted-c mt-1">{t('register.nickname_hint')}</div>
          </label>
          {role === 'esnaf' && (
            <label className="block">
              <div className="text-sm font-medium mb-1">{t('register.shop_label')}</div>
              <input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder={t('register.shop_ph')} className={inputCls} />
              <div className="text-xs text-muted-c mt-1">{t('register.shop_hint')}</div>
            </label>
          )}
          <label className="block">
            <div className="text-sm font-medium mb-1">{t('register.city_label')}</div>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('register.city_ph')} className={inputCls} />
          </label>
        </div>

        <ConsentBlock
          ageGroup={ageGroup}
          onAgeGroup={setAgeGroup}
          guardian={guardian}
          onGuardian={setGuardian}
          consent={consent}
          onConsent={setConsent}
        />

        {error && (
          <div className="mt-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-6">
          <button type="button" className="btn" disabled={busy} onClick={() => void cancel()}>
            {t('complete.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => void save()}>
            {busy ? t('common.loading') : t('complete.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

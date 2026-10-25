'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n, type Locale } from '@/lib/i18n';
import { getLevelInfo } from '@/lib/levels';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { isAdminUser } from '@/lib/auth';
import { formatTL } from '@/lib/debts';
import AccountSecurity from '@/components/profile/AccountSecurity';

const DATE_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-US', ar: 'ar' };

function fmtDate(iso: string, locale: Locale) {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const profile = useZimemStore((s) => s.profile);
  const xp = useZimemStore((s) => s.xp);
  const debtsPaid = useZimemStore((s) => s.debtsPaid);
  const totalDonated = useZimemStore((s) => s.totalDonated);
  const streak = useZimemStore((s) => s.streak);
  const merchantDebts = useZimemStore((s) => s.merchantDebts);
  const logout = useZimemStore((s) => s.logout);
  const { t, locale } = useI18n();

  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => setMounted(true), []);

  // Yönetici yetkisi sunucunun yönettiği app_metadata.role'dedir; profil bunu taşımadığı
  // için oturumdan ayrıca okunur.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    void sb.auth.getSession().then(({ data }) => {
      if (active) setIsAdmin(isAdminUser(data.session?.user));
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (active) setIsAdmin(isAdminUser(session?.user));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!mounted || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-c text-sm">
        {t('common.loading')}
      </div>
    );
  }

  const isEsnaf = profile.role === 'esnaf';
  const level = getLevelInfo(xp);
  const openDebts = merchantDebts.filter((d) => !d.closed).length;
  const closedDebts = merchantDebts.filter((d) => d.closed).length;

  const handleLogout = async () => {
    if (confirm(t('profile.logout_confirm'))) {
      await logout();
      router.replace(isSupabaseConfigured() ? '/login/' : '/register/');
    }
  };

  return (
    <div className="pt-6 max-w-2xl mx-auto">
      <section className="glass-strong p-7 mb-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl bg-amber-400 text-[#1a1207] flex items-center justify-center text-2xl font-black shrink-0 uppercase"
            aria-hidden
          >
            {Array.from(profile.displayName.trim() || '?')[0]}
          </div>
          <div className="min-w-0">
            <div className="section-title">{isEsnaf ? t('profile.role_merchant') : t('profile.role_citizen')}</div>
            <h1 className="heading-xl truncate">{profile.displayName}</h1>
            {isEsnaf && profile.shopName && (
              <div className="text-sm text-muted-c mt-0.5 truncate">{profile.shopName}</div>
            )}
          </div>
        </div>
      </section>

      <section className="glass p-5 mb-6">
        <div className="section-title mb-3">{t('profile.info_section')}</div>
        <div className="divide-y divide-white/5">
          <InfoRow label={t('profile.f_nickname')} value={profile.displayName} />
          <InfoRow label={t('profile.f_role')} value={isEsnaf ? t('profile.role_merchant_badge') : t('profile.role_citizen_badge')} />
          {isEsnaf && profile.shopName && <InfoRow label={t('profile.f_shop')} value={profile.shopName} />}
          <InfoRow label={t('profile.f_city')} value={profile.city || '—'} />
          <InfoRow label={t('profile.f_join')} value={fmtDate(profile.createdAt, locale)} />
          {profile.username && (
            <InfoRow
              label={profile.username.includes('@') ? t('profile.f_email') : t('profile.f_username')}
              value={profile.username}
              mono
            />
          )}
        </div>
      </section>

      <section className="glass p-5 mb-6">
        <div className="section-title mb-3">
          {isEsnaf ? t('profile.summary_merchant') : t('profile.summary_citizen')}
        </div>
        {isEsnaf ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('profile.open_debt')} value={openDebts} color="text-amber-300" />
            <Stat label={t('profile.closed_debt')} value={closedDebts} color="text-emerald-300" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <div className="font-bold">{t(`levels.${level.current.key}`)}</div>
                {level.next && (
                  <div className="text-xs text-muted-c">
                    {t('score.to_next', { level: t(`levels.${level.next.key}`), xp: level.remaining })}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t('profile.total_xp')} value={xp} color="text-amber-300" />
              <Stat label={t('profile.closed_debt')} value={debtsPaid} color="text-emerald-300" />
              <Stat label={t('profile.donated_short')} value={formatTL(totalDonated, locale)} color="text-emerald-300" />
              <Stat label={t('profile.streak_short')} value={t('score.streak_days', { n: streak })} color="text-amber-300" />
            </div>
          </>
        )}
      </section>

      {/* Sekmelerde yer almayan sayfalar */}
      {!isEsnaf && (
        <section className="glass p-5 mb-6">
          <div className="section-title mb-3">{t('profile.more')}</div>
          <div className="space-y-2">
            <ProfileLink router={router} href="/iyilik-hali" title={t('profile.link_wellbeing_title')} desc={t('profile.link_wellbeing_desc')} />
            <ProfileLink router={router} href="/achievements" title={t('profile.link_ach_title')} desc={t('profile.link_ach_desc')} />
            <ProfileLink router={router} href="/tree" title={t('profile.link_tree_title')} desc={t('profile.link_tree_desc')} />
            <ProfileLink router={router} href="/stats" title={t('profile.link_stats_title')} desc={t('profile.link_stats_desc')} />
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="glass p-5 mb-6">
          <div className="section-title mb-3">{t('profile.admin_section')}</div>
          <div className="space-y-2">
            <ProfileLink
              router={router}
              href="/admin"
              title={t('profile.admin_link_title')}
              desc={t('profile.admin_link_desc')}
            />
          </div>
        </section>
      )}

      {isSupabaseConfigured() && profile.username && <AccountSecurity username={profile.username} />}

      <section className="glass p-5">
        <div className="section-title mb-1">{t('profile.account')}</div>
        <p className="text-xs text-muted-c mb-4">
          {t('profile.account_desc')}
        </p>
        <button type="button" onClick={handleLogout} className="btn w-full !text-red-300 !border-red-500/30 hover:!bg-red-500/10">
          {t('profile.logout_btn')}
        </button>
      </section>
    </div>
  );
}

function ProfileLink({
  router, href, title, desc,
}: { router: ReturnType<typeof useRouter>; href: string; title: string; desc: string }) {
  // APK'da (statik dışa aktarım + WebView) düz <a href> tam sayfa yüklemesi yapıp
  // başarısız oluyor; uygulama içi yollar router.push ile açılır.
  return (
    <button
      type="button"
      onClick={() => router.push(href.endsWith('/') ? href : `${href}/`)}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/15 transition-all text-inherit text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{title}</div>
        <div className="text-[11px] text-muted-c truncate">{desc}</div>
      </div>
      <span className="text-muted-c text-sm">→</span>
    </button>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-muted-c shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color} truncate`}>{value}</div>
    </div>
  );
}

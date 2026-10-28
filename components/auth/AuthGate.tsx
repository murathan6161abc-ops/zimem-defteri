'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { useZimemStore } from '@/store/useZimemStore';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { fetchAccountData, profileFromMetadata, setAuthCache } from '@/lib/auth';
import { sessionNeedsMfa } from '@/lib/accountSecurity';
import { completeWebOAuthIfPresent, listenForNativeOAuth, publishGoogleError } from '@/lib/googleAuth';
import { useI18n } from '@/lib/i18n';

const LOGIN = '/login/';
const REGISTER = '/register/';
const ESNAF_HOME = '/esnaf/';
const VATANDAS_HOME = '/';

const LOGIN_PATHS = ['/login', '/login/'];
const REGISTER_PATHS = ['/register', '/register/'];
const ADMIN_PATHS = ['/admin', '/admin/'];
const FORGOT_PATHS = ['/sifremi-unuttum', '/sifremi-unuttum/'];
const COMPLETE = '/profil-tamamla/';
const COMPLETE_PATHS = ['/profil-tamamla', '/profil-tamamla/'];

// Supabase yapılandırılmışsa gerçek oturum (kullanıcı adı+şifre) modu;
// değilse eski yerel-profil moduna düşülür (env'siz derlemeler için).
const authMode = isSupabaseConfigured();
const ENTRY = authMode ? LOGIN : REGISTER;

function isLogin(p: string) {
  return LOGIN_PATHS.includes(p);
}
function isRegister(p: string) {
  return REGISTER_PATHS.includes(p);
}
function isAdmin(p: string) {
  return ADMIN_PATHS.includes(p);
}
function isPublic(p: string) {
  return isLogin(p) || isRegister(p) || isAdmin(p) || FORGOT_PATHS.includes(p) || COMPLETE_PATHS.includes(p);
}
function startsWithEsnaf(p: string) {
  return p === '/esnaf' || p === '/esnaf/' || p.startsWith('/esnaf/');
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const profile = useZimemStore((s) => s.profile);
  // Legacy modda hemen hazır; auth modunda oturum kontrolü bitince hazır.
  const [ready, setReady] = useState(!authMode);
  const hydratedUid = useRef<string | null>(null);
  // Google ile ilk kez giren hesapta rol/takma ad/araştırma onayı yok → tamamlatılır.
  const [needsProfile, setNeedsProfile] = useState(false);
  const [googleError, setGoogleError] = useState(false);

  // ─── Oturum bootstrap (yalnızca Supabase yapılandırılmışsa) ──────────
  useEffect(() => {
    if (!authMode) return;
    const client = getSupabase();
    if (!client) {
      setReady(true);
      return;
    }
    let active = true;

    const applySession = async (session: Session | null) => {
      const store = useZimemStore.getState();
      // 2FA'lı hesapta yalnızca şifre girilmişse (aal1) uygulamaya ALINMAZ:
      // profil yüklenmez, kullanıcı giriş ekranındaki kod adımına yönlenir.
      // (Veritabanı da aal1 oturuma hiçbir veri vermez — asıl koruma orada.)
      // Aynı şekilde e-posta kodu doğrulanmış ama şifre/profil adımı bitmemiş
      // (yarım kalmış) kayıt da giriş yapılmış sayılmaz.
      const signupUnfinished = session?.user?.user_metadata?.signupCompleted === false;
      if (session?.user && (signupUnfinished || sessionNeedsMfa(session))) {
        setAuthCache(null);
        hydratedUid.current = null;
        setNeedsProfile(false);
        if (store.profile) store.clearProfile();
        return;
      }
      // Onam (consentAt) yoksa profil eksik: Google ile ilk giriş. Tüm eski
      // kayıt yolları consentAt yazar; bu yüzden eski hesaplar etkilenmez.
      if (session?.user && !session.user.user_metadata?.consentAt) {
        setAuthCache(session.user.id);
        hydratedUid.current = null;
        setNeedsProfile(true);
        if (store.profile) store.clearProfile();
        return;
      }
      setNeedsProfile(false);
      if (session?.user) {
        setAuthCache(session.user.id);
        const prof = profileFromMetadata(session.user);
        if (store.profile?.username === prof.username) {
          // Aynı hesap zaten yüklü — yalnızca profili tazele (ağır yükleme yok)
          store.setProfile(prof);
          hydratedUid.current = session.user.id;
        } else if (hydratedUid.current !== session.user.id) {
          // Hesap değişti / yerelde yok → sunucudan tam yükle
          hydratedUid.current = session.user.id;
          const data = await fetchAccountData(session.user.id);
          // Veri yüklenirken çıkış yapıldıysa ya da hesap değiştiyse eski veriyi kurma.
          if (!active || hydratedUid.current !== session.user.id) return;
          useZimemStore.getState().hydrateAccount(prof, data);
        }
      } else {
        setAuthCache(null);
        hydratedUid.current = null;
        if (useZimemStore.getState().profile) useZimemStore.getState().clearProfile();
      }
    };

    (async () => {
      const { data } = await client.auth.getSession();
      if (!active) return;
      await applySession(data.session);
      if (active) setReady(true);
      // Web: Google'dan (giriş ya da hesap bağlama) ?code=… ile dönüldüyse oturumu tamamla.
      // Giriş sayfasında değil burada yapılır: oturum açıkken giriş sayfası hiç açılmaz.
      const web = await completeWebOAuthIfPresent();
      if (active && web && !web.ok) {
        publishGoogleError(web.error, web.detail);
        setGoogleError(true);
      }
    })();

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    // APK: Google girişinden com.dzimem.app://login-callback ile dönüşü yakala.
    const stopOAuth = listenForNativeOAuth((code, detail) => {
      publishGoogleError(code, detail);
      if (active) setGoogleError(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      stopOAuth();
    };
  }, []);

  // Google dönüşü başarısızsa giriş ekranında hata göster.
  useEffect(() => {
    if (!googleError) return;
    setGoogleError(false);
    // Hesap bağlama (oturum açık) hatası Profil'de, giriş hatası giriş ekranında gösterilir.
    router.replace(useZimemStore.getState().profile ? '/profil/' : `${LOGIN}?google=hata`);
  }, [googleError, router]);

  // ─── Yönlendirme ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;

    // Kayıt-tamamlanma bayrağı YALNIZCA /register → ana sayfa geçişi içindir.
    // /register dışındaki her yolda temizle ki bayatlamasın; aksi halde sonraki
    // "Kayıt Ol" ziyaretinde AuthGate logout'u atlayıp kullanıcıyı eski profille
    // uygulamaya düşürüyordu (kayıt formu hiç görünmüyordu).
    if (!isRegister(pathname)) {
      try {
        sessionStorage.removeItem('d-zimem-skip-register-logout');
        sessionStorage.removeItem('d-zimem-signup-in-progress');
      } catch {}
    }

    // Google ile ilk giriş: profil tamamlanana kadar yalnızca tamamlama ekranı
    if (needsProfile) {
      if (!COMPLETE_PATHS.includes(pathname)) router.replace(COMPLETE);
      return;
    }

    // Profil (oturum) yoksa → giriş ekranına
    if (!profile && !isPublic(pathname)) {
      router.replace(ENTRY);
      return;
    }

    // Profil varsa giriş / profil-tamamlama sayfasında durmasın → ana sayfaya
    if (profile && (isLogin(pathname) || COMPLETE_PATHS.includes(pathname))) {
      router.replace(profile.role === 'esnaf' ? ESNAF_HOME : VATANDAS_HOME);
      return;
    }

    // Kayıt sayfasına oturum açıkken gelmek = "yeni hesap aç" niyeti.
    // Paylaşılan cihazda kalan oturumu kapat ki kayıt formu görünsün.
    // AMA: kayıt yeni tamamlandıysa (handleFinish bayrağı) oturumu KORU — aksi
    // halde signIn'in kurduğu oturum hemen silinip kimlik cihaza düşüyordu.
    if (profile && isRegister(pathname)) {
      let justRegistered = false;
      try {
        // E-posta kodu doğrulanınca kayıt bitmeden oturum açılır; kayıt sayfası
        // bu bayrağı işlem boyunca tutar (başka sayfaya geçince yukarıda silinir).
        const inProgress = !!sessionStorage.getItem('d-zimem-signup-in-progress');
        justRegistered = inProgress || !!sessionStorage.getItem('d-zimem-skip-register-logout');
        if (!inProgress && justRegistered) sessionStorage.removeItem('d-zimem-skip-register-logout');
      } catch {}
      if (!justRegistered) {
        void useZimemStore.getState().logout();
      }
      return;
    }

    // Esnaf, vatandaş anasayfasına girmesin
    if (profile?.role === 'esnaf' && (pathname === '/' || pathname === '')) {
      router.replace(ESNAF_HOME);
      return;
    }

    // Vatandaş, esnaf alanına girmesin
    if (profile?.role === 'vatandas' && startsWithEsnaf(pathname)) {
      router.replace(VATANDAS_HOME);
      return;
    }
  }, [ready, profile, pathname, router, needsProfile]);

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-c text-sm">
        {t('common.loading')}
      </div>
    );
  }

  if (!profile && !isPublic(pathname)) return null;
  // Kayıt sürerken (e-posta kodu doğrulanırken) kısa süreli açılan oturum kayıt
  // sayfasını gizleyip sıfırlamasın; sayfa sonucu (ör. "zaten hesap var") göstermeli.
  let signupInProgress = false;
  try {
    signupInProgress = !!sessionStorage.getItem('d-zimem-signup-in-progress');
  } catch {}
  if (profile && (isLogin(pathname) || (isRegister(pathname) && !signupInProgress))) return null;

  return <>{children}</>;
}

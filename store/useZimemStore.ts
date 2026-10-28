import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Debt,
  HistoryEntry,
  PreTestData,
  PostTestData,
  ModalStep,
  UserProfile,
  MerchantDebt,
} from '@/types';
import { calculateXP } from '@/lib/xp';
import { checkUnlocks } from '@/lib/achievements';
import { computeStreak } from '@/lib/streak';
import { syncSurveySubmission, syncDeviceSnapshot } from '@/lib/sync';
import { deleteMerchantDebt, insertMerchantDebt } from '@/lib/supabaseDebts';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchMyMerchantDebts, getCurrentUserId, signOut, type AccountData } from '@/lib/auth';
import { tStatic } from '@/lib/i18n';
import { iconOf, kindOf } from '@/lib/debts';

interface ToastMsg {
  id: string;
  emoji: string;
  title: string;
  desc?: string;
}

interface ZimemState {
  profile: UserProfile | null;

  xp: number;
  debtsPaid: number;
  totalDonated: number;
  streak: number;
  lastActionDate: string | null;
  unlockedAchievements: string[];
  history: HistoryEntry[];
  openDebts: Debt[];
  merchantDebts: MerchantDebt[];

  // YENİ: kısmi ödeme takibi { debtId: toplamÖdenen }
  partialPayments: Record<string, number>;

  // modal flow
  modalStep: ModalStep;
  activeDebtId: string | null;
  activePayAmount: number | null; // YENİ: kısmi ödeme tutarı (null = tam)
  preData: PreTestData | null;
  postData: PostTestData | null;
  lastResult: { xp: number; newAchievements: string[]; isPartial?: boolean } | null;

  // toasts
  toasts: ToastMsg[];

  // actions
  setProfile: (p: UserProfile) => void;
  clearProfile: () => void;

  // YENİ: hesap (giriş/çıkış) — kimlik karışmasını önler
  hydrateAccount: (profile: UserProfile, data: AccountData) => void;
  logout: () => Promise<void>;

  // YENİ: Supabase ile borç senkronizasyonu
  setOpenDebts: (debts: Debt[]) => void;
  applyRemoteDebtInsert: (debt: Debt) => void;
  applyRemoteDebtUpdate: (debt: Debt) => void;
  // true → borç bu cihazın listesinde hâlâ açıktı (başka biri kapattı ya da sildi).
  applyRemoteDebtClose: (id: string) => boolean;

  startFlow: (debtId: string, partialAmount?: number | null) => void;
  submitPretest: (data: PreTestData) => void;
  confirmPayment: () => void;
  submitPosttest: (data: PostTestData) => void;
  closeModal: () => void;

  // Esnafın defterini sunucudaki listeyle değiştirir.
  setMerchantDebts: (debts: MerchantDebt[]) => void;
  // Sunucudan gelen tek borç değişikliğini deftere uygular; true → borç bu değişiklikle kapandı.
  applyMerchantDebtChange: (debt: MerchantDebt) => boolean;

  // null → Supabase'e yazılamadı, hiçbir yere kaydedilmedi (esnaf tekrar dener).
  // synced=false → Supabase ayarlanmamış (çevrimdışı demo); kayıt yalnızca bu cihazda.
  addMerchantDebt: (input: Omit<Debt, 'id'>) => Promise<{ id: string; synced: boolean } | null>;
  // false → sunucuda silinemedi (bağlantı yok ya da borç artık açık değil); liste değişmez.
  removeMerchantDebt: (id: string) => Promise<boolean>;
  // Esnaf defterini sunucudaki kayıtlarla eşitler (giriş sırasındaki yarışta düşen kayıtlar geri gelir).
  refreshMerchantDebts: () => Promise<void>;

  pushToast: (t: Omit<ToastMsg, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const initialState = {
  profile: null as UserProfile | null,

  xp: 0,
  debtsPaid: 0,
  totalDonated: 0,
  streak: 0,
  lastActionDate: null as string | null,
  unlockedAchievements: [] as string[],
  history: [] as HistoryEntry[],
  // openDebts artık Supabase'ten yüklenir — boş başla
  openDebts: [] as Debt[],
  merchantDebts: [] as MerchantDebt[],
  partialPayments: {} as Record<string, number>,

  modalStep: 'closed' as ModalStep,
  activeDebtId: null as string | null,
  activePayAmount: null as number | null,
  preData: null as PreTestData | null,
  postData: null as PostTestData | null,
  lastResult: null as { xp: number; newAchievements: string[]; isPartial?: boolean } | null,

  toasts: [] as ToastMsg[],
};

// Sunucu kapanan borcun tutarını 0 yapar ve ilk tutarı saklamaz. Bu cihaz borcu daha
// önce açıkken gördüyse son bilinen tutar "hibe edilen" olarak korunur (arada kısmi
// ödeme olduysa bu, son kalan tutardır). İkon sunucuda tutulmadığı için esnafın seçtiği
// ikon da korunur.
function mergeMerchantDebt(incoming: MerchantDebt, known: MerchantDebt | undefined): MerchantDebt {
  if (!known) return incoming;
  return {
    ...incoming,
    icon: known.icon,
    amount: incoming.closed && incoming.amount === 0 ? known.amount : incoming.amount,
  };
}

export const useZimemStore = create<ZimemState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProfile: (p) => set({ profile: p }),
      clearProfile: () => set({ profile: null }),

      // ─── Hesap girişi: sunucu verisi yerel state'i TAMAMEN değiştirir ──
      // Aynı tarayıcıda başka bir hesaba geçildiğinde önceki kullanıcının
      // verisi (XP, geçmiş, esnaf defteri) sızmasın diye hepsi sıfırlanıp
      // giriş yapan hesabın verisiyle doldurulur.
      hydrateAccount: (profile, data) => {
        // Başarımları istatistiğe göre sessizce (toast'sız) yeniden türet
        const unlocked = checkUnlocks({
          xp: data.xp,
          debtsPaid: data.debtsPaid,
          streak: data.streak,
          totalDonated: data.totalDonated,
          history: data.history,
          unlocked: new Set<string>(),
        }).map((a) => a.id);

        set({
          profile,
          xp: data.xp,
          debtsPaid: data.debtsPaid,
          totalDonated: data.totalDonated,
          streak: data.streak,
          lastActionDate: data.lastActionDate,
          history: data.history,
          merchantDebts: data.merchantDebts,
          unlockedAchievements: unlocked,
          partialPayments: {},
          // modal/toast durumunu da temizle
          modalStep: 'closed',
          activeDebtId: null,
          activePayAmount: null,
          preData: null,
          postData: null,
          lastResult: null,
          toasts: [],
        });
      },

      // ─── Çıkış: oturumu kapat ve TÜM yerel veriyi sıfırla ──────────────
      logout: async () => {
        await signOut();
        set({ ...initialState });
      },

      // ─── Supabase debt senkronizasyon aksiyonları ───────────────

      setOpenDebts: (debts) => set({ openDebts: debts }),

      applyRemoteDebtInsert: (debt) =>
        set((s) => {
          if (s.openDebts.some((d) => d.id === debt.id)) return s;
          return { openDebts: [debt, ...s.openDebts] };
        }),

      applyRemoteDebtUpdate: (debt) =>
        set((s) => ({
          openDebts: s.openDebts.map((d) => (d.id === debt.id ? { ...d, ...debt } : d)),
        })),

      applyRemoteDebtClose: (id) => {
        const wasOpen = get().openDebts.some((d) => d.id === id);
        if (wasOpen) set((s) => ({ openDebts: s.openDebts.filter((d) => d.id !== id) }));
        return wasOpen;
      },

      setMerchantDebts: (debts) =>
        set((s) => {
          const known = new Map(s.merchantDebts.map((d) => [d.id, d]));
          return { merchantDebts: debts.map((d) => mergeMerchantDebt(d, known.get(d.id))) };
        }),

      applyMerchantDebtChange: (debt) => {
        const known = get().merchantDebts.find((d) => d.id === debt.id);
        const merged = mergeMerchantDebt(debt, known);
        set((s) => ({
          merchantDebts: known
            ? s.merchantDebts.map((d) => (d.id === debt.id ? merged : d))
            : [merged, ...s.merchantDebts],
        }));
        return !!known && !known.closed && !!merged.closed;
      },

      // ─── Merchant (esnaf) borç ekleme — Supabase write sync.ts'te ──

      addMerchantDebt: async (input) => {
        const profile = get().profile;
        const merchantName = profile?.shopName || profile?.displayName || 'Anonim Esnaf';
        const online = isSupabaseConfigured();

        let debt: MerchantDebt;
        if (online) {
          // Supabase'e yaz (Realtime ile diğer cihazlara yayılır). Yazılamazsa yerel
          // kayıt OLUŞTURULMAZ: sonraki girişte kaybolan, kimsenin göremediği bir borç
          // yerine esnaf hatayı görür ve tekrar dener.
          const remote = await insertMerchantDebt({
            title: input.title,
            description: input.description,
            category: input.category,
            kind: input.kind,
            icon: input.icon,
            amount: input.amount,
            urgency: input.urgency,
            merchantName,
            city: profile?.city,
          });
          if (!remote) return null;
          // Sunucunun temizlediği metin esas alınır; ikon göçü çalıştırılmamışsa sunucu
          // varsayılan ikon döndürür, bu yüzden esnafın seçtiği ikon bu cihazda korunur.
          debt = { ...remote, icon: input.icon || remote.icon };
        } else {
          // Supabase ayarlanmamış (çevrimdışı demo): kayıt yalnızca bu cihazda tutulur.
          debt = {
            ...input,
            id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            addedBy: merchantName,
            addedAt: new Date().toISOString(),
          };
        }

        // Yerel state'e ekle (anında UI feedback). Realtime aynı borcu daha önce
        // getirmiş olabilir — iki listede de duplikasyonu önle.
        set((s) => ({
          merchantDebts: s.merchantDebts.some((d) => d.id === debt.id) ? s.merchantDebts : [debt, ...s.merchantDebts],
          openDebts: s.openDebts.some((d) => d.id === debt.id) ? s.openDebts : [debt, ...s.openDebts],
        }));
        return { id: debt.id, synced: online };
      },

      refreshMerchantDebts: async () => {
        const server = await fetchMyMerchantDebts(getCurrentUserId());
        if (!server) return; // çevrimdışı: yerel liste olduğu gibi kalır
        set((s) => {
          const ids = new Set(server.map((d) => d.id));
          // Sunucuya hiç yazılamamış yerel kayıtlar ("m-" önekli) korunur.
          const localOnly = s.merchantDebts.filter((d) => d.id.startsWith('m-') && !ids.has(d.id));
          return { merchantDebts: [...localOnly, ...server] };
        });
      },

      removeMerchantDebt: async (id) => {
        // "m-" önekli kayıtlar sunucuya hiç yazılamamış yerel kayıtlardır.
        const ok = id.startsWith('m-') ? true : await deleteMerchantDebt(id);
        if (!ok) return false;
        set((s) => ({
          merchantDebts: s.merchantDebts.filter((d) => d.id !== id),
          openDebts: s.openDebts.filter((d) => d.id !== id),
        }));
        return true;
      },

      // ─── Ödeme akışı (kısmi destekli) ────────────────────────────

      startFlow: (debtId, partialAmount = null) =>
        set({
          activeDebtId: debtId,
          activePayAmount: partialAmount, // null = tam ödeme
          modalStep: 'pretest',
          preData: null,
          postData: null,
          lastResult: null,
        }),

      submitPretest: (data) => set({ preData: data, modalStep: 'payment' }),

      confirmPayment: () => set({ modalStep: 'posttest' }),

      submitPosttest: (data) => {
        const s = get();
        const debt = s.openDebts.find((d) => d.id === s.activeDebtId);
        if (!debt || !s.preData) {
          // Borç eşzamanlı kapanmış/silinmişse modal'ı sıfırla — kullanıcı
          // posttest adımında kilitli kalmasın.
          set({
            modalStep: 'closed',
            activeDebtId: null,
            activePayAmount: null,
            preData: null,
            postData: null,
          });
          return;
        }

        // Kısmi ödeme mi tam ödeme mi?
        const payAmount =
          s.activePayAmount !== null && s.activePayAmount > 0
            ? Math.min(s.activePayAmount, debt.amount)
            : debt.amount;
        const isPartial = payAmount < debt.amount;

        const xpGain = calculateXP(s.preData, data, debt, payAmount);
        const now = new Date();
        const { streak, dateKey } = computeStreak(s.lastActionDate, s.streak, now);

        const entry: HistoryEntry = {
          id: `${debt.id}-${now.getTime()}`,
          debtId: debt.id,
          date: now.toISOString(),
          category: debt.category,
          title: debt.title,
          amount: payAmount,
          xp: xpGain,
          preEmotion: s.preData.emotion,
          postEmotion: data.emotion,
          willRepeat: data.willRepeat,
          urgency: debt.urgency,
          kind: kindOf(debt),
          icon: iconOf(debt),
        };

        // Yeni borç durumu
        const newOpenDebts = isPartial
          ? s.openDebts.map((d) =>
              d.id === debt.id ? { ...d, amount: d.amount - payAmount } : d,
            )
          : s.openDebts.filter((d) => d.id !== debt.id);

        // Kısmi ödeme takibi
        const newPartial = { ...s.partialPayments };
        if (isPartial) {
          newPartial[debt.id] = (newPartial[debt.id] || 0) + payAmount;
        } else {
          delete newPartial[debt.id];
        }

        const newState = {
          xp: s.xp + xpGain,
          // debtsPaid sadece tam kapanışta artar
          debtsPaid: s.debtsPaid + (isPartial ? 0 : 1),
          totalDonated: s.totalDonated + payAmount,
          history: [entry, ...s.history],
          openDebts: newOpenDebts,
          partialPayments: newPartial,
          merchantDebts: s.merchantDebts.map((m) =>
            m.id === debt.id && !isPartial
              ? { ...m, closed: true, closedAt: now.toISOString() }
              : m.id === debt.id
                ? { ...m, amount: m.amount - payAmount }
                : m,
          ),
          streak,
          lastActionDate: dateKey,
        };

        const unlocked = new Set(s.unlockedAchievements);
        const newOnes = checkUnlocks({
          xp: newState.xp,
          debtsPaid: newState.debtsPaid,
          streak: newState.streak,
          totalDonated: newState.totalDonated,
          history: newState.history,
          unlocked,
        });
        const newIds = newOnes.map((a) => a.id);

        set({
          ...newState,
          postData: data,
          unlockedAchievements: [...s.unlockedAchievements, ...newIds],
          modalStep: 'result',
          lastResult: { xp: xpGain, newAchievements: newIds, isPartial },
          activePayAmount: null,
          toasts: [
            ...s.toasts,
            ...newOnes.map((a) => ({
              id: `${a.id}-${Date.now()}`,
              emoji: a.emoji,
              title: tStatic(a.nameKey),
              desc: tStatic(a.descKey),
            })),
          ],
        });

        // Anket gönderimi + (yeni) Supabase borç güncelleme
        void syncSurveySubmission({
          debt,
          pre: s.preData,
          post: data,
          entry,
          profile: s.profile,
          payAmount,
          isPartial,
        });

        // Liderlik tablosu canlı kalsın — her kapanışta güncel snapshot gönder
        // (önceden yalnızca /liderlik ziyaretinde güncelleniyordu)
        void syncDeviceSnapshot({
          profile: s.profile,
          xp: newState.xp,
          debtsPaid: newState.debtsPaid,
          totalDonated: newState.totalDonated,
          streak: newState.streak,
        });
      },

      closeModal: () =>
        set({
          modalStep: 'closed',
          activeDebtId: null,
          activePayAmount: null,
          preData: null,
          postData: null,
        }),

      pushToast: (t) =>
        set((s) => ({ toasts: [...s.toasts, { ...t, id: `t-${Date.now()}-${Math.random()}` }] })),

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'zimem-defteri-state-v1',
      // openDebts artık Supabase'ten gelir — persist etme
      partialize: (s) => ({
        profile: s.profile,
        xp: s.xp,
        debtsPaid: s.debtsPaid,
        totalDonated: s.totalDonated,
        streak: s.streak,
        lastActionDate: s.lastActionDate,
        unlockedAchievements: s.unlockedAchievements,
        history: s.history,
        partialPayments: s.partialPayments,
        merchantDebts: s.merchantDebts,
      }),
    },
  ),
);

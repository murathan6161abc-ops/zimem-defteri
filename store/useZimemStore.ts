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
import { deleteMerchantDebt, insertMerchantDebt, payMerchantDebtRemote } from '@/lib/supabaseDebts';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchMyMerchantDebts, getCurrentUserId, signOut, type AccountData } from '@/lib/auth';
import { tStatic } from '@/lib/i18n';
import { iconOf, kindOf } from '@/lib/debts';

interface ToastMsg {
  id: string;
  title: string;
  desc?: string;
}

/** Sunucunun onayladığı ödeme: gerçekten düşülen tutar ve borçta kalan. */
interface ConfirmedPayment {
  paid: number;
  remaining: number;
}

export type PaymentOutcome = 'ok' | 'gone' | 'error';

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

  // Bu cihazdan yapılan kısmi katkılar: { borçId: toplam }
  partialPayments: Record<string, number>;

  // Ödeme akışı. activeDebt, akış başladığı andaki borcun kopyasıdır: liste bu sırada
  // değişse (başkası kısmi ödeme yapsa, borç kapansa) bile pencereler aynı borcu gösterir.
  modalStep: ModalStep;
  activeDebt: Debt | null;
  activePayAmount: number | null; // null = borcun tamamı
  payment: ConfirmedPayment | null;
  preData: PreTestData | null;
  postData: PostTestData | null;
  lastResult: { xp: number; newAchievements: string[]; remaining: number } | null;

  toasts: ToastMsg[];

  setProfile: (p: UserProfile) => void;
  clearProfile: () => void;

  // Giriş: yerel veriyi giriş yapan hesabın verisiyle tamamen değiştirir.
  hydrateAccount: (profile: UserProfile, data: AccountData) => void;
  logout: () => Promise<void>;

  setOpenDebts: (debts: Debt[]) => void;
  applyRemoteDebtInsert: (debt: Debt) => void;
  applyRemoteDebtUpdate: (debt: Debt) => void;
  // true → borcu başka biri kapattı ya da sildi (kullanıcıya haber verilebilir).
  applyRemoteDebtClose: (id: string) => boolean;

  startFlow: (debtId: string, partialAmount?: number | null) => void;
  submitPretest: (data: PreTestData) => void;
  // Ödemeyi sunucuya yazar. 'gone' → borç bu arada kapanmış/silinmiş, akış kapanır;
  // 'error' → bağlantı sorunu, kullanıcı tekrar deneyebilir.
  confirmPayment: () => Promise<PaymentOutcome>;
  submitPosttest: (data: PostTestData) => void;
  closeModal: () => void;

  // Esnafın defterini sunucudaki listeyle değiştirir.
  setMerchantDebts: (debts: MerchantDebt[]) => void;
  // Sunucudan gelen tek borç değişikliğini deftere uygular; true → borç bu değişiklikle kapandı.
  applyMerchantDebtChange: (debt: MerchantDebt) => boolean;

  // null → sunucuya yazılamadı, hiçbir yere kaydedilmedi (esnaf tekrar dener).
  // synced=false → Supabase ayarlanmamış (çevrimdışı demo); kayıt yalnızca bu cihazda.
  addMerchantDebt: (input: Omit<Debt, 'id'>) => Promise<{ id: string; synced: boolean } | null>;
  // false → sunucuda silinemedi (bağlantı yok ya da borç artık açık değil); liste değişmez.
  removeMerchantDebt: (id: string) => Promise<boolean>;
  // Esnaf defterini sunucudaki kayıtlarla eşitler (giriş sırasındaki yarışta düşen kayıtlar geri gelir).
  refreshMerchantDebts: () => Promise<void>;

  pushToast: (t: Omit<ToastMsg, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const closedFlow = {
  modalStep: 'closed' as ModalStep,
  activeDebt: null as Debt | null,
  activePayAmount: null as number | null,
  payment: null as ConfirmedPayment | null,
  preData: null as PreTestData | null,
  postData: null as PostTestData | null,
};

const initialState = {
  profile: null as UserProfile | null,

  xp: 0,
  debtsPaid: 0,
  totalDonated: 0,
  streak: 0,
  lastActionDate: null as string | null,
  unlockedAchievements: [] as string[],
  history: [] as HistoryEntry[],
  // Açık borçlar her açılışta sunucudan yüklenir.
  openDebts: [] as Debt[],
  merchantDebts: [] as MerchantDebt[],
  partialPayments: {} as Record<string, number>,

  ...closedFlow,
  lastResult: null as { xp: number; newAchievements: string[]; remaining: number } | null,

  toasts: [] as ToastMsg[],
};

// Sunucu kapanan borcun tutarını 0 yapar ve ilk tutarı saklamaz. Bu cihaz borcu daha
// önce açıkken gördüyse son bilinen tutar "hibe edilen" olarak korunur (arada kısmi
// ödeme olduysa bu, son kalan tutardır).
function mergeMerchantDebt(incoming: MerchantDebt, known: MerchantDebt | undefined): MerchantDebt {
  if (!known) return incoming;
  return {
    ...incoming,
    amount: incoming.closed && incoming.amount === 0 ? known.amount : incoming.amount,
  };
}

export const useZimemStore = create<ZimemState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProfile: (p) => set({ profile: p }),
      clearProfile: () => set({ profile: null }),

      // Aynı tarayıcıda başka hesaba geçilince önceki kullanıcının XP'si, geçmişi ve
      // defteri görünmesin diye her şey giriş yapan hesabın verisiyle değiştirilir.
      hydrateAccount: (profile, data) => {
        // Başarımlar istatistikten yeniden hesaplanır (bildirim gösterilmeden).
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
          ...closedFlow,
          lastResult: null,
          toasts: [],
        });
      },

      logout: async () => {
        await signOut();
        set({ ...initialState });
      },

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
        const s = get();
        const wasOpen = s.openDebts.some((d) => d.id === id);
        if (wasOpen) set({ openDebts: s.openDebts.filter((d) => d.id !== id) });
        // Kullanıcının şu an ödediği borç: olay kendi ödemesinden gelmiş olabilir. Başkası
        // kapattıysa bunu ödeme adımında sunucunun cevabından öğrenir.
        if (s.activeDebt?.id === id) return false;
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

      addMerchantDebt: async (input) => {
        const profile = get().profile;
        const merchantName = profile?.shopName || profile?.displayName || 'Anonim Esnaf';
        const online = isSupabaseConfigured();

        let debt: MerchantDebt;
        if (online) {
          // Sunucuya yazılamazsa yerel kayıt da oluşturulmaz: başka kimsenin göremeyeceği
          // ve sonraki girişte kaybolacak bir borç yerine esnaf hatayı görüp tekrar dener.
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
          debt = {
            ...input,
            id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            addedBy: merchantName,
            addedAt: new Date().toISOString(),
          };
        }

        // Realtime aynı borcu bu cevaptan önce getirmiş olabilir; iki kez eklenmesin.
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
        // "m-" önekli kayıtlar yalnızca bu cihazda duran demo kayıtlarıdır.
        const ok = id.startsWith('m-') ? true : await deleteMerchantDebt(id);
        if (!ok) return false;
        set((s) => ({
          merchantDebts: s.merchantDebts.filter((d) => d.id !== id),
          openDebts: s.openDebts.filter((d) => d.id !== id),
        }));
        return true;
      },

      startFlow: (debtId, partialAmount = null) => {
        const debt = get().openDebts.find((d) => d.id === debtId);
        if (!debt) return;
        const partial = partialAmount !== null && partialAmount > 0 && partialAmount < debt.amount ? partialAmount : null;
        set({
          ...closedFlow,
          modalStep: 'pretest',
          activeDebt: { ...debt },
          activePayAmount: partial,
          lastResult: null,
        });
      },

      submitPretest: (data) => set({ preData: data, modalStep: 'payment' }),

      confirmPayment: async () => {
        const { activeDebt: debt, activePayAmount, preData } = get();
        if (!debt || !preData) return 'gone';
        const requested = activePayAmount ?? debt.amount;

        let paid: number;
        let remaining: number;
        if (isSupabaseConfigured()) {
          let result: Awaited<ReturnType<typeof payMerchantDebtRemote>>;
          try {
            result = await payMerchantDebtRemote(debt.id, requested);
          } catch {
            return 'error';
          }
          if (!result) {
            set((s) => ({ ...closedFlow, openDebts: s.openDebts.filter((d) => d.id !== debt.id) }));
            get().pushToast({ title: tStatic('payment.gone_title'), desc: tStatic('payment.gone_desc') });
            return 'gone';
          }
          // Aynı anda başka biri de ödediyse sunucu kalan kadarını düşer.
          paid = result.paidAmount;
          remaining = result.newAmount;
        } else {
          paid = Math.min(requested, debt.amount);
          remaining = debt.amount - paid;
        }

        const closedAt = new Date().toISOString();
        set((s) => {
          const partialPayments = { ...s.partialPayments };
          if (remaining > 0) partialPayments[debt.id] = (partialPayments[debt.id] || 0) + paid;
          else delete partialPayments[debt.id];
          return {
            payment: { paid, remaining },
            modalStep: 'posttest',
            partialPayments,
            openDebts:
              remaining > 0
                ? s.openDebts.map((d) => (d.id === debt.id ? { ...d, amount: remaining } : d))
                : s.openDebts.filter((d) => d.id !== debt.id),
            merchantDebts: s.merchantDebts.map((m) =>
              m.id !== debt.id ? m : remaining > 0 ? { ...m, amount: remaining } : { ...m, closed: true, closedAt },
            ),
          };
        });
        return 'ok';
      },

      submitPosttest: (data) => {
        const s = get();
        const debt = s.activeDebt;
        const payment = s.payment;
        if (!debt || !s.preData || !payment) {
          set(closedFlow);
          return;
        }

        const xpGain = calculateXP(s.preData, data, debt, payment.paid);
        const now = new Date();
        const { streak, dateKey } = computeStreak(s.lastActionDate, s.streak, now);
        const closedDebt = payment.remaining === 0;

        const entry: HistoryEntry = {
          id: `${debt.id}-${now.getTime()}`,
          debtId: debt.id,
          date: now.toISOString(),
          category: debt.category,
          title: debt.title,
          amount: payment.paid,
          xp: xpGain,
          preEmotion: s.preData.emotion,
          postEmotion: data.emotion,
          willRepeat: data.willRepeat,
          urgency: debt.urgency,
          kind: kindOf(debt),
          icon: iconOf(debt),
        };

        const stats = {
          xp: s.xp + xpGain,
          // Kapanan borç sayısı yalnızca borç tamamen kapanınca artar.
          debtsPaid: s.debtsPaid + (closedDebt ? 1 : 0),
          totalDonated: s.totalDonated + payment.paid,
          history: [entry, ...s.history],
          streak,
          lastActionDate: dateKey,
        };

        const newOnes = checkUnlocks({ ...stats, unlocked: new Set(s.unlockedAchievements) });
        const newIds = newOnes.map((a) => a.id);

        set({
          ...stats,
          postData: data,
          unlockedAchievements: [...s.unlockedAchievements, ...newIds],
          modalStep: 'result',
          lastResult: { xp: xpGain, newAchievements: newIds, remaining: payment.remaining },
          toasts: [
            ...s.toasts,
            ...newOnes.map((a) => ({
              id: `${a.id}-${Date.now()}`,
              title: tStatic(a.nameKey),
              desc: tStatic(a.descKey),
            })),
          ],
        });

        void syncSurveySubmission({
          debt,
          pre: s.preData,
          post: data,
          entry,
          profile: s.profile,
        });
        // Liderlik tablosu her iyilikten sonra güncellenir.
        void syncDeviceSnapshot({
          profile: s.profile,
          xp: stats.xp,
          debtsPaid: stats.debtsPaid,
          totalDonated: stats.totalDonated,
          streak: stats.streak,
        });
      },

      closeModal: () => set(closedFlow),

      pushToast: (t) =>
        set((s) => ({ toasts: [...s.toasts, { ...t, id: `t-${Date.now()}-${Math.random()}` }] })),

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'zimem-defteri-state-v1',
      // Açık borçlar ve ödeme akışı saklanmaz; her açılışta sunucudan gelir.
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

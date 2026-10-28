import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Debt, MerchantDebt } from '@/types';

// Ağ sınırı: Supabase yazımları, ödeme RPC'si ve anket/liderlik gönderimi taklit edilir.
const { insertMerchantDebt, isSupabaseConfigured, payMerchantDebtRemote, syncSurveySubmission } = vi.hoisted(() => ({
  insertMerchantDebt: vi.fn(async (): Promise<unknown> => null),
  isSupabaseConfigured: vi.fn(() => true),
  payMerchantDebtRemote: vi.fn(async (id: string, amount: number): Promise<unknown> => ({
    id,
    paidAmount: amount,
    newAmount: 0,
    closed: true,
    closedAt: '2026-10-24T09:00:00Z',
  })),
  syncSurveySubmission: vi.fn(async () => {}),
}));

vi.mock('@/lib/sync', () => ({
  syncSurveySubmission,
  syncDeviceSnapshot: vi.fn(async () => {}),
}));
vi.mock('@/lib/supabaseDebts', () => ({
  insertMerchantDebt,
  payMerchantDebtRemote,
  deleteMerchantDebt: vi.fn(async () => true),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured, getSupabase: () => null }));

import { useZimemStore } from './useZimemStore';

function debt(id: string, amount = 480): Debt {
  return { id, category: 'gida', title: 'Ekmek borcu', description: 'Temel gıda', amount, urgency: 3 };
}

const pre = { huzur: 5, emotion: 'merak', emotionValue: 2, likert: 4 } as const;
const post = { huzur: 8, emotion: 'mutlu', emotionValue: 4, likert: 5, willRepeat: 'evet' } as const;

beforeEach(() => {
  useZimemStore.setState({
    openDebts: [],
    merchantDebts: [],
    modalStep: 'closed',
    activeDebt: null,
    activePayAmount: null,
    payment: null,
    preData: null,
    postData: null,
    toasts: [],
    xp: 0,
    debtsPaid: 0,
    totalDonated: 0,
    history: [],
    partialPayments: {},
  });
  syncSurveySubmission.mockClear();
});

describe('applyRemoteDebtClose', () => {
  it('başkasının kapattığı açık borcu listeden çıkarır ve bunu bildirir', () => {
    useZimemStore.setState({ openDebts: [debt('d1'), debt('d2')] });

    expect(useZimemStore.getState().applyRemoteDebtClose('d1')).toBe(true);
    expect(useZimemStore.getState().openDebts.map((d) => d.id)).toEqual(['d2']);
  });

  it('kullanıcının kendi kapattığı borç için gelen olayı yeni kapanma saymaz', async () => {
    useZimemStore.setState({ openDebts: [debt('d1')] });
    useZimemStore.getState().startFlow('d1', null);
    useZimemStore.getState().submitPretest(pre);
    await useZimemStore.getState().confirmPayment();
    useZimemStore.getState().submitPosttest(post);

    expect(useZimemStore.getState().applyRemoteDebtClose('d1')).toBe(false);
  });

  it('kapanma olayı ödeme cevabından önce gelirse de bildirim göstermez', () => {
    useZimemStore.setState({ openDebts: [debt('d1')] });
    useZimemStore.getState().startFlow('d1', null);

    expect(useZimemStore.getState().applyRemoteDebtClose('d1')).toBe(false);
    expect(useZimemStore.getState().activeDebt?.id).toBe('d1');
  });
});

describe('ödeme akışı', () => {
  function startAndPretest(id: string, partial: number | null = null) {
    useZimemStore.getState().startFlow(id, partial);
    useZimemStore.getState().submitPretest(pre);
  }

  it('ödeme onaylanınca borcu kapatır, son testten sonra XP ve geçmişi yazar', async () => {
    useZimemStore.setState({ openDebts: [debt('d1')] });
    startAndPretest('d1');

    expect(await useZimemStore.getState().confirmPayment()).toBe('ok');
    expect(useZimemStore.getState().openDebts).toEqual([]);
    expect(useZimemStore.getState().modalStep).toBe('posttest');

    useZimemStore.getState().submitPosttest(post);
    const s = useZimemStore.getState();
    expect(s.modalStep).toBe('result');
    expect(s.debtsPaid).toBe(1);
    expect(s.totalDonated).toBe(480);
    expect(s.history[0]).toMatchObject({ debtId: 'd1', amount: 480 });
    expect(s.xp).toBeGreaterThan(0);
    expect(syncSurveySubmission).toHaveBeenCalledTimes(1);
  });

  it('borç bu arada kapanmışsa akışı kapatır, XP ve geçmiş yazmaz', async () => {
    useZimemStore.setState({ openDebts: [debt('d1')] });
    startAndPretest('d1');
    payMerchantDebtRemote.mockResolvedValueOnce(null);

    expect(await useZimemStore.getState().confirmPayment()).toBe('gone');
    const s = useZimemStore.getState();
    expect(s.modalStep).toBe('closed');
    expect(s.openDebts).toEqual([]);
    expect(s.xp).toBe(0);
    expect(s.history).toEqual([]);
    expect(s.toasts).toHaveLength(1);
  });

  it('bağlantı hatasında ödeme adımında kalır, borç listede durur', async () => {
    useZimemStore.setState({ openDebts: [debt('d1')] });
    startAndPretest('d1');
    payMerchantDebtRemote.mockRejectedValueOnce(new Error('Failed to fetch'));

    expect(await useZimemStore.getState().confirmPayment()).toBe('error');
    expect(useZimemStore.getState().modalStep).toBe('payment');
    expect(useZimemStore.getState().openDebts).toHaveLength(1);
  });

  it('sunucunun gerçekten düştüğü tutarı kullanır', async () => {
    useZimemStore.setState({ openDebts: [debt('d1', 480)] });
    startAndPretest('d1', 200);
    // Arada başka biri 400 ₺ ödemiş: sunucu yalnızca kalan 80 ₺'yi düşer.
    payMerchantDebtRemote.mockResolvedValueOnce({ id: 'd1', paidAmount: 80, newAmount: 0, closed: true, closedAt: null });

    await useZimemStore.getState().confirmPayment();
    useZimemStore.getState().submitPosttest(post);

    const s = useZimemStore.getState();
    expect(s.totalDonated).toBe(80);
    expect(s.debtsPaid).toBe(1);
    expect(s.lastResult?.remaining).toBe(0);
  });

  it('kısmi katkı borcu kapatmazsa kalan tutarı listeye yansıtır', async () => {
    useZimemStore.setState({ openDebts: [debt('d1', 480)] });
    startAndPretest('d1', 100);
    payMerchantDebtRemote.mockResolvedValueOnce({ id: 'd1', paidAmount: 100, newAmount: 380, closed: false, closedAt: null });

    await useZimemStore.getState().confirmPayment();
    useZimemStore.getState().submitPosttest(post);

    const s = useZimemStore.getState();
    expect(s.openDebts[0]).toMatchObject({ id: 'd1', amount: 380 });
    expect(s.partialPayments).toEqual({ d1: 100 });
    expect(s.debtsPaid).toBe(0);
    expect(s.lastResult?.remaining).toBe(380);
  });
});

function merchantDebt(id: string, patch: Partial<MerchantDebt> = {}): MerchantDebt {
  return {
    ...debt(id, 180),
    addedBy: 'Köşe Bakkalı',
    addedAt: '2026-10-20T09:00:00Z',
    closed: false,
    ...patch,
  };
}

describe('setMerchantDebts', () => {
  it('kapanan borcun son bilinen tutarını korur, sunucudaki yeni borcu ekler', () => {
    useZimemStore.setState({
      merchantDebts: [merchantDebt('a'), merchantDebt('m-yerel', { amount: 50 })],
    });

    useZimemStore.getState().setMerchantDebts([
      merchantDebt('a', { amount: 0, closed: true, closedAt: '2026-10-24T09:00:00Z' }),
      merchantDebt('b', { amount: 90 }),
    ]);

    const book = useZimemStore.getState().merchantDebts;
    expect(book.map((d) => d.id)).toEqual(['a', 'b']);
    expect(book[0]).toMatchObject({ closed: true, amount: 180 });
    expect(book[1]).toMatchObject({ amount: 90, closed: false });
  });
});

describe('applyMerchantDebtChange', () => {
  it('açık borç kapanınca bunu bildirir ve hibe edilen tutarı korur', () => {
    useZimemStore.setState({ merchantDebts: [merchantDebt('a')] });

    const closedNow = useZimemStore
      .getState()
      .applyMerchantDebtChange(merchantDebt('a', { amount: 0, closed: true, closedAt: '2026-10-24T09:00:00Z' }));

    expect(closedNow).toBe(true);
    expect(useZimemStore.getState().merchantDebts[0]).toMatchObject({ closed: true, amount: 180 });
  });

  it('kısmi ödemede kalan tutarı günceller ama kapanma bildirmez', () => {
    useZimemStore.setState({ merchantDebts: [merchantDebt('a')] });

    const closedNow = useZimemStore.getState().applyMerchantDebtChange(merchantDebt('a', { amount: 100 }));

    expect(closedNow).toBe(false);
    expect(useZimemStore.getState().merchantDebts[0]).toMatchObject({ closed: false, amount: 100 });
  });
});

describe('addMerchantDebt', () => {
  const input = {
    category: 'gida' as const,
    title: '<b>Ekmek</b> borcu',
    description: 'Temel gıda',
    amount: 180,
    urgency: 2 as const,
  };

  it('sunucu kaydı reddedince cihazda hayalet kayıt oluşturmaz', async () => {
    insertMerchantDebt.mockResolvedValueOnce(null);

    const result = await useZimemStore.getState().addMerchantDebt(input);

    expect(result).toBeNull();
    expect(useZimemStore.getState().merchantDebts).toEqual([]);
    expect(useZimemStore.getState().openDebts).toEqual([]);
  });

  it('kaydı sunucunun temizlediği değerlerle deftere ekler', async () => {
    insertMerchantDebt.mockResolvedValueOnce({
      id: 'srv-1',
      category: 'gida',
      title: 'Ekmek borcu',
      description: 'Temel gıda',
      amount: 180,
      urgency: 2,
      addedBy: 'Köşe Bakkalı',
      addedAt: '2026-10-24T09:00:00Z',
      closed: false,
    });

    const result = await useZimemStore.getState().addMerchantDebt(input);

    expect(result).toEqual({ id: 'srv-1', synced: true });
    expect(useZimemStore.getState().merchantDebts[0]).toMatchObject({
      id: 'srv-1',
      title: 'Ekmek borcu',
    });
  });

  it('Supabase ayarlanmamışsa (çevrimdışı demo) kaydı yalnızca bu cihazda tutar', async () => {
    isSupabaseConfigured.mockReturnValueOnce(false);

    const result = await useZimemStore.getState().addMerchantDebt(input);

    expect(result).toMatchObject({ synced: false });
    expect(result?.id).toMatch(/^m-/);
    expect(useZimemStore.getState().merchantDebts).toHaveLength(1);
  });
});

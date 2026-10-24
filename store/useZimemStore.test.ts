import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Debt, MerchantDebt } from '@/types';

// Ağ sınırı: Supabase yazımları ve anket/liderlik gönderimi taklit edilir.
const { insertMerchantDebt, isSupabaseConfigured } = vi.hoisted(() => ({
  insertMerchantDebt: vi.fn(async (): Promise<unknown> => null),
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock('@/lib/sync', () => ({
  syncSurveySubmission: vi.fn(async () => {}),
  syncDeviceSnapshot: vi.fn(async () => {}),
}));
vi.mock('@/lib/supabaseDebts', () => ({
  insertMerchantDebt,
  deleteMerchantDebt: vi.fn(async () => true),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured, getSupabase: () => null }));

import { useZimemStore } from './useZimemStore';

function debt(id: string, amount = 480): Debt {
  return { id, category: 'gida', title: 'Ekmek borcu', description: 'Temel gıda', amount, urgency: 3, icon: '🍞' };
}

beforeEach(() => {
  useZimemStore.setState({
    openDebts: [],
    merchantDebts: [],
    modalStep: 'closed',
    activeDebtId: null,
    activePayAmount: null,
    preData: null,
    postData: null,
    toasts: [],
  });
});

describe('applyRemoteDebtClose', () => {
  it('başkasının kapattığı açık borcu listeden çıkarır ve bunu bildirir', () => {
    useZimemStore.setState({ openDebts: [debt('d1'), debt('d2')] });

    expect(useZimemStore.getState().applyRemoteDebtClose('d1')).toBe(true);
    expect(useZimemStore.getState().openDebts.map((d) => d.id)).toEqual(['d2']);
  });

  it('kullanıcının kendi kapattığı borç için gelen olayı yeni kapanma saymaz', () => {
    useZimemStore.setState({ openDebts: [debt('d1')] });
    const store = useZimemStore.getState();
    store.startFlow('d1', null);
    useZimemStore.getState().submitPretest({ huzur: 5, emotion: 'merak', emotionValue: 2, likert: 4 });
    useZimemStore.getState().confirmPayment();
    useZimemStore.getState().submitPosttest({ huzur: 8, emotion: 'mutlu', emotionValue: 4, likert: 5, willRepeat: 'evet' });

    expect(useZimemStore.getState().applyRemoteDebtClose('d1')).toBe(false);
  });
});

function merchantDebt(id: string, patch: Partial<MerchantDebt> = {}): MerchantDebt {
  return {
    ...debt(id, 180),
    icon: '🛒',
    addedBy: 'Köşe Bakkalı',
    addedAt: '2026-10-20T09:00:00Z',
    closed: false,
    ...patch,
  };
}

describe('setMerchantDebts', () => {
  it('kapanan borcun son bilinen tutarını ve seçilen ikonu korur, sunucudaki yeni borcu ekler', () => {
    useZimemStore.setState({
      merchantDebts: [merchantDebt('a', { icon: '🥖' }), merchantDebt('m-yerel', { amount: 50 })],
    });

    useZimemStore.getState().setMerchantDebts([
      merchantDebt('a', { amount: 0, closed: true, closedAt: '2026-10-24T09:00:00Z' }),
      merchantDebt('b', { amount: 90 }),
    ]);

    const book = useZimemStore.getState().merchantDebts;
    expect(book.map((d) => d.id)).toEqual(['a', 'b']);
    expect(book[0]).toMatchObject({ closed: true, amount: 180, icon: '🥖' });
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
    icon: '🥖',
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

  it('kaydı sunucunun temizlediği değerlerle deftere ekler, seçilen ikonu korur', async () => {
    insertMerchantDebt.mockResolvedValueOnce({
      id: 'srv-1',
      category: 'gida',
      title: 'Ekmek borcu',
      description: 'Temel gıda',
      amount: 180,
      urgency: 2,
      icon: '🛒',
      addedBy: 'Köşe Bakkalı',
      addedAt: '2026-10-24T09:00:00Z',
      closed: false,
    });

    const result = await useZimemStore.getState().addMerchantDebt(input);

    expect(result).toEqual({ id: 'srv-1', synced: true });
    expect(useZimemStore.getState().merchantDebts[0]).toMatchObject({
      id: 'srv-1',
      title: 'Ekmek borcu',
      icon: '🥖',
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

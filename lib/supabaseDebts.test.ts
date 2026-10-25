import { beforeEach, describe, expect, it, vi } from 'vitest';

type Payload = { new?: Record<string, unknown>; old?: Record<string, unknown> };

// Ağ sınırı: Realtime dinleyicilerini, tablo okuma ve yazımlarını yakalayan sahte istemci.
const { handlers, filters, inserted, selectResult, fakeClient } = vi.hoisted(() => {
  const handlers = new Map<string, (payload: Payload) => void>();
  const filters = new Map<string, Record<string, unknown>>();
  const inserted: Record<string, unknown>[] = [];
  const selectResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
  const channel = {
    on(_type: string, filter: Record<string, unknown> & { event: string }, cb: (payload: Payload) => void) {
      handlers.set(filter.event, cb);
      filters.set(filter.event, filter);
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  const fakeClient = {
    getChannels: () => [],
    channel: () => channel,
    removeChannel: async () => 'ok',
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { ...row, id: 'srv-1', created_at: '2026-10-24T09:00:00Z' }, error: null }),
          }),
        };
      },
      select: () => ({
        eq: () => ({
          order: async () => selectResult,
        }),
      }),
    }),
  };
  return { handlers, filters, inserted, selectResult, fakeClient };
});

vi.mock('./supabase', () => ({ getSupabase: () => fakeClient }));

import { fetchMyMerchantDebts, insertMerchantDebt, subscribeToDebts, subscribeToMyDebts } from './supabaseDebts';

function fire(event: string, payload: Payload) {
  const cb = handlers.get(event);
  if (!cb) throw new Error(`${event} olayı dinlenmiyor`);
  cb(payload);
}

const closedRow = {
  id: 'd1',
  merchant_name: 'Köşe Bakkalı',
  title: 'Ekmek borcu',
  description: 'Temel gıda',
  category: 'gida',
  amount: 0,
  urgency: 3,
  closed: true,
  closed_at: '2026-10-24T09:00:00Z',
  created_at: '2026-10-20T09:00:00Z',
};

describe('subscribeToDebts', () => {
  it('kapanan borcu kapanma olarak bildirir, silinme olarak değil', () => {
    const onClose = vi.fn();
    const onDelete = vi.fn();
    subscribeToDebts({ onClose, onDelete });

    fire('UPDATE', { new: closedRow });

    expect(onClose).toHaveBeenCalledWith('d1');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('esnafın sildiği borcu silinme olarak bildirir, kapanma olarak değil', () => {
    const onClose = vi.fn();
    const onDelete = vi.fn();
    subscribeToDebts({ onClose, onDelete });

    fire('DELETE', { old: { id: 'd2' } });

    expect(onDelete).toHaveBeenCalledWith('d2');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('kısmi ödemeyle azalan borcu güncelleme olarak bildirir', () => {
    const onUpdate = vi.fn();
    const onClose = vi.fn();
    subscribeToDebts({ onUpdate, onClose });

    fire('UPDATE', { new: { ...closedRow, amount: 300, closed: false, closed_at: null } });

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1', amount: 300 }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('subscribeToMyDebts', () => {
  it('yalnızca esnafın kendi borçlarındaki değişikliği dinler ve deftere uygun biçimde iletir', () => {
    const onChange = vi.fn();
    subscribeToMyDebts('u1', onChange);

    expect(filters.get('UPDATE')).toMatchObject({ table: 'merchant_debts', filter: 'user_id=eq.u1' });
    fire('UPDATE', { new: closedRow });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1', closed: true, addedBy: 'Köşe Bakkalı' }));
  });
});

describe('fetchMyMerchantDebts', () => {
  it('esnafın borçlarını deftere uygun biçime çevirir', async () => {
    selectResult.data = [closedRow];
    selectResult.error = null;

    expect(await fetchMyMerchantDebts('u1')).toEqual([
      expect.objectContaining({ id: 'd1', closed: true, amount: 0, addedBy: 'Köşe Bakkalı' }),
    ]);
  });

  it('sunucu hatasında null döner, boş liste değil', async () => {
    selectResult.data = null;
    selectResult.error = { message: 'ağ hatası' };

    expect(await fetchMyMerchantDebts('u1')).toBeNull();
  });
});

describe('insertMerchantDebt', () => {
  beforeEach(() => {
    inserted.length = 0;
  });

  it('100.000 ₺ üstü tutarı kırpmadan reddeder', async () => {
    const result = await insertMerchantDebt({
      title: 'Ekmek borcu',
      description: 'Temel gıda',
      category: 'gida',
      amount: 150000,
      urgency: 2,
    });

    expect(result).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  it('geçerli borcu temizlenmiş metinle yazar', async () => {
    const result = await insertMerchantDebt({
      title: '<b>Ekmek</b> borcu',
      description: 'Temel gıda',
      category: 'gida',
      amount: 180,
      urgency: 2,
    });

    expect(inserted[0]).toMatchObject({ title: 'Ekmek borcu', amount: 180, closed: false });
    expect(result).toMatchObject({ id: 'srv-1', title: 'Ekmek borcu', amount: 180 });
  });

  it('temizlik sonrası boş kalan dükkan adı ve şehri boş bırakır, kaydı engellemez', async () => {
    await insertMerchantDebt({
      title: 'Ekmek borcu',
      description: 'Temel gıda',
      category: 'gida',
      amount: 180,
      urgency: 2,
      merchantName: '🏪',
      city: '34',
    });

    expect(inserted[0]).toMatchObject({ merchant_name: null, city: null });
  });

  it('şehirde virgül ve eğik çizgiyi korur', async () => {
    await insertMerchantDebt({
      title: 'Ekmek borcu',
      description: 'Temel gıda',
      category: 'gida',
      amount: 180,
      urgency: 2,
      city: 'Fatih, İstanbul',
    });

    expect(inserted[0]).toMatchObject({ city: 'Fatih, İstanbul' });
  });
});

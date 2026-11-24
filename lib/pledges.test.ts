import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ağ sınırı: RPC çağrılarını kaydeden ve hazır cevap dönen sahte istemci.
const { rpcCalls, rpcResult, configured, fakeClient } = vi.hoisted(() => {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpcResult: { data: unknown; error: { message: string; code?: string } | null } = { data: null, error: null };
  const configured = { value: true };
  const fakeClient = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return rpcResult;
    },
  };
  return { rpcCalls, rpcResult, configured, fakeClient };
});

vi.mock('./supabase', () => ({
  getSupabase: () => (configured.value ? fakeClient : null),
  isSupabaseConfigured: () => configured.value,
}));

import {
  cancelPledge,
  createPledge,
  daysWaiting,
  isStuckPledge,
  markPledgeSent,
  formatIban,
  isValidTrIban,
  normalizeIban,
  pledgeFailureFrom,
  resolvePledge,
  rowToPledge,
} from './pledges';

const debt = { id: 'd1', title: 'Ekmek borcu' };

beforeEach(() => {
  rpcCalls.length = 0;
  rpcResult.data = null;
  rpcResult.error = null;
  configured.value = true;
});

describe('IBAN', () => {
  it('boşlukları atar ve büyük harfe çevirir', () => {
    expect(normalizeIban(' tr33 0006 1005 1978 6457 8413 26 ')).toBe('TR330006100519786457841326');
  });

  it('mod-97 denetimi geçen TR IBAN kabul edilir, bir hanesi yanlış olan reddedilir', () => {
    expect(isValidTrIban('TR33 0006 1005 1978 6457 8413 26')).toBe(true);
    expect(isValidTrIban('TR330006100519786457841327')).toBe(false);
  });

  it('yabancı ya da eksik IBAN reddedilir', () => {
    expect(isValidTrIban('DE89370400440532013000')).toBe(false);
    expect(isValidTrIban('TR3300061005')).toBe(false);
  });

  it('dörtlü gruplarla gösterilir', () => {
    expect(formatIban('TR330006100519786457841326')).toBe('TR33 0006 1005 1978 6457 8413 26');
  });
});

describe('sunucu hata kodları', () => {
  it('kalan tutarı ayıklar', () => {
    expect(pledgeFailureFrom('amount_exceeds_available:200')).toEqual({ reason: 'exceeds', available: 200 });
  });

  it.each(['adult_only', 'not_payable', 'own_debt', 'no_iban', 'too_many_pending'] as const)('%s tanınır', (code) => {
    expect(pledgeFailureFrom(`ERROR: ${code}`).reason).toBe(code);
  });

  it('göç çalıştırılmamışsa özellik kapalı sayılır', () => {
    expect(pledgeFailureFrom('Could not find the function public.create_debt_pledge PGRST202').reason).toBe('unavailable');
  });

  it('bilinmeyen hata genel hatadır', () => {
    expect(pledgeFailureFrom('network down').reason).toBe('error');
  });
});

describe('createPledge', () => {
  it('RPC sonucunu ödeme koduna ve IBAN bilgisine çevirir', async () => {
    rpcResult.data = [
      {
        id: 'p1',
        code: 'DZ-98EAD0',
        amount: 300,
        method: 'havale',
        status: 'pending',
        created_at: '2026-11-24T10:00:00Z',
        merchant_name: 'Köşe Bakkalı',
        city: 'Fatih',
        iban: 'TR330006100519786457841326',
        account_holder: 'Ali Bakkal',
      },
    ];
    const result = await createPledge(debt, 300, 'havale');
    expect(rpcCalls[0]).toEqual({ fn: 'create_debt_pledge', args: { p_debt_id: 'd1', p_amount: 300, p_method: 'havale' } });
    expect(result).toMatchObject({
      ok: true,
      pledge: { code: 'DZ-98EAD0', debtId: 'd1', debtTitle: 'Ekmek borcu', merchantName: 'Köşe Bakkalı', iban: 'TR330006100519786457841326' },
    });
  });

  it('sunucu reddederse nedeni döner', async () => {
    rpcResult.error = { message: 'adult_only' };
    expect(await createPledge(debt, 100, 'dukkan')).toEqual({ ok: false, reason: 'adult_only' });
  });

  it('küsuratlı ya da sıfır tutar sunucuya gitmez', async () => {
    expect((await createPledge(debt, 0, 'dukkan')).ok).toBe(false);
    expect((await createPledge(debt, 10.5, 'dukkan')).ok).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it('çevrimdışı demoda kod bu cihazda üretilir; havale yoktur', async () => {
    configured.value = false;
    const result = await createPledge(debt, 50, 'dukkan');
    expect(result.ok && result.pledge.code).toMatch(/^DZ-[A-F0-9]{6}$/);
    expect(await createPledge(debt, 50, 'havale')).toEqual({ ok: false, reason: 'no_iban' });
    expect(rpcCalls).toHaveLength(0);
  });
});

describe('esnaf onayı', () => {
  it('"aldım" sonucu borcun yeni tutarını döner', async () => {
    rpcResult.data = [{ pledge_id: 'p1', pledge_status: 'confirmed', debt_id: 'd1', paid_amount: 300, new_amount: 200, closed: false }];
    expect(await resolvePledge('p1', true)).toEqual({ status: 'confirmed', debtId: 'd1', paidAmount: 300, newAmount: 200, closed: false });
    expect(rpcCalls[0].args).toEqual({ p_pledge_id: 'p1', p_received: true });
  });

  it('taahhüt artık beklemiyorsa null', async () => {
    rpcResult.data = [];
    expect(await resolvePledge('p1', false)).toBeNull();
  });
});

describe('iptal', () => {
  it('demo kaydı sunucuya gitmeden iptal edilir', async () => {
    expect(await cancelPledge('demo-1')).toBe(true);
    expect(rpcCalls).toHaveLength(0);
  });

  it('sunucu true dönerse iptal olur', async () => {
    rpcResult.data = true;
    expect(await cancelPledge('p1')).toBe(true);
  });
});

describe('rowToPledge', () => {
  it('borç bilgisini gömülü satırdan alır, bilinmeyen durumu bekliyor sayar', () => {
    const pledge = rowToPledge({
      id: 'p1',
      debt_id: 'd1',
      amount: '120',
      code: 'DZ-AAAAAA',
      method: 'nakit',
      status: 'garip',
      created_at: '2026-11-24T10:00:00Z',
      merchant_debts: { title: 'İlaç', merchant_name: 'Eczane', city: 'Bornova' },
    });
    expect(pledge).toMatchObject({ amount: 120, method: 'dukkan', status: 'pending', debtTitle: 'İlaç', merchantName: 'Eczane', city: 'Bornova' });
  });
});

describe('gönderildi ve takip', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  const base = rowToPledge({ id: 'p1', debt_id: 'd1', amount: 100, code: 'DZ-AAAAAA', method: 'havale', status: 'pending', created_at: '2026-11-20T12:00:00Z' });

  it('sent_at satırdan okunur', () => {
    expect(rowToPledge({ id: 'p1', sent_at: '2026-11-21T09:00:00Z' }).sentAt).toBe('2026-11-21T09:00:00Z');
  });

  it('bekleme süresi gönderildiyse gönderim anından sayılır', () => {
    expect(daysWaiting(base, now)).toBe(4);
    expect(daysWaiting({ ...base, sentAt: '2026-11-23T12:00:00Z' }, now)).toBe(1);
  });

  it('3 günü geçen bekleyen ve son 30 günde reddedilen takip listesine girer', () => {
    expect(isStuckPledge(base, now)).toBe(true);
    expect(isStuckPledge({ ...base, createdAt: '2026-11-23T12:00:00Z' }, now)).toBe(false);
    expect(isStuckPledge({ ...base, status: 'rejected', resolvedAt: '2026-11-10T12:00:00Z' }, now)).toBe(true);
    expect(isStuckPledge({ ...base, status: 'rejected', resolvedAt: '2026-09-01T12:00:00Z' }, now)).toBe(false);
    expect(isStuckPledge({ ...base, status: 'confirmed' }, now)).toBe(false);
  });

  it('"gönderdim" sunucuya gider; demo kaydı yerelde işaretlenir', async () => {
    rpcResult.data = '2026-11-24T12:00:00Z';
    expect(await markPledgeSent('p1')).toBe('2026-11-24T12:00:00Z');
    expect(rpcCalls[0]).toEqual({ fn: 'mark_pledge_sent', args: { p_pledge_id: 'p1' } });
    rpcCalls.length = 0;
    expect(await markPledgeSent('demo-1')).toBeTruthy();
    expect(rpcCalls).toHaveLength(0);
  });

  it('başkasının ya da artık beklemeyen ödeme işaretlenemez (sunucu null döner)', async () => {
    rpcResult.data = null;
    expect(await markPledgeSent('p2')).toBeNull();
  });
});

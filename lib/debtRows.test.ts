import { describe, expect, it } from 'vitest';
import { DEBT_COLUMNS, DEBT_COLUMNS_KIND, DEBT_COLUMNS_LEGACY, rowToDebt, withDebtColumns } from './debtRows';

const row = {
  id: 'd1',
  merchant_name: 'Köşe Bakkalı',
  title: 'Ekmek',
  description: 'Haftalık',
  category: 'gida',
  amount: 240,
  urgency: 3,
  created_at: '2026-11-24T10:00:00Z',
};

describe('rowToDebt — muhtar doğrulaması', () => {
  it('bilinen durumları ve onay tarihini taşır', () => {
    expect(rowToDebt({ ...row, verification_status: 'verified', verified_at: '2026-11-24T11:00:00Z' })).toMatchObject({
      verification: 'verified',
      verifiedAt: '2026-11-24T11:00:00Z',
    });
    expect(rowToDebt({ ...row, verification_status: 'rejected' }).verification).toBe('rejected');
  });

  it('sütun yoksa ya da değer bilinmiyorsa doğrulanmamış sayılır', () => {
    expect(rowToDebt(row).verification).toBeUndefined();
    expect(rowToDebt({ ...row, verification_status: 'onayli' }).verification).toBeUndefined();
  });
});

describe('withDebtColumns', () => {
  it('eksik sütunda bir eski sütun setine iner', async () => {
    const tried: string[] = [];
    const result = await withDebtColumns(async (columns) => {
      tried.push(columns);
      if (columns.includes('verification_status')) {
        return { error: { message: 'column merchant_debts.verification_status does not exist' } };
      }
      if (columns.includes('kind')) return { error: { message: 'column merchant_debts.kind does not exist' } };
      return { error: null };
    });
    expect(tried).toEqual([DEBT_COLUMNS, DEBT_COLUMNS_KIND, DEBT_COLUMNS_LEGACY]);
    expect(result.error).toBeNull();
  });

  it('başka bir hatada yeniden denemez', async () => {
    const tried: string[] = [];
    await withDebtColumns(async (columns) => {
      tried.push(columns);
      return { error: { message: 'JWT expired' } };
    });
    expect(tried).toEqual([DEBT_COLUMNS]);
  });
});

'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import type { Category } from '@/types';
import {
  fetchOpenDebts,
  subscribeToDebts,
} from '@/lib/supabaseDebts';
import { isSupabaseConfigured } from '@/lib/supabase';
import { SAMPLE_DEBTS } from '@/lib/debts';
import { useI18n, tStatic } from '@/lib/i18n';
import DebtCard from './DebtCard';
import DebtFilters from './DebtFilters';

export default function DebtList() {
  const { t } = useI18n();
  const openDebts = useZimemStore((s) => s.openDebts);
  const startFlow = useZimemStore((s) => s.startFlow);
  const setOpenDebts = useZimemStore((s) => s.setOpenDebts);
  const applyRemoteDebtInsert = useZimemStore((s) => s.applyRemoteDebtInsert);
  const applyRemoteDebtUpdate = useZimemStore((s) => s.applyRemoteDebtUpdate);
  const applyRemoteDebtClose = useZimemStore((s) => s.applyRemoteDebtClose);
  const pushToast = useZimemStore((s) => s.pushToast);

  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // ─── İlk yükleme + Realtime aboneliği ─────────────────────────
  useEffect(() => {
    setMounted(true);
    if (initialized.current) return;
    initialized.current = true;

    let unsubscribe: (() => void) | null = null;

    async function bootstrap() {
      // Supabase yoksa → yerel SAMPLE_DEBTS göster
      if (!isSupabaseConfigured()) {
        setOpenDebts(SAMPLE_DEBTS);
        setLoading(false);
        return;
      }

      // Açık borçları çek. Örnek kayıtlar güvenli veritabanı göçünde eklenir;
      // istemcinin ortak tabloyu seed etme yetkisi yoktur.
      const debts = await fetchOpenDebts();
      setOpenDebts(debts);
      setLoading(false);

      // Realtime'a abone ol
      unsubscribe = subscribeToDebts({
        onInsert: (debt) => {
          applyRemoteDebtInsert(debt);
          pushToast({
            emoji: '📋',
            title: tStatic('debt.toast_new_title'),
            desc: debt.title,
          });
        },
        onUpdate: (debt) => {
          applyRemoteDebtUpdate(debt);
        },
        onDelete: (id) => {
          applyRemoteDebtClose(id);
          pushToast({
            emoji: '✅',
            title: tStatic('debt.toast_closed_title'),
            desc: tStatic('debt.toast_closed_desc'),
          });
        },
      });
    }

    void bootstrap();

    return () => {
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(
    () =>
      !mounted
        ? []
        : filter === 'all'
          ? openDebts
          : openDebts.filter((d) => d.category === filter),
    [mounted, filter, openDebts],
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h2 className="heading-lg">{t('debt.open_debts')}</h2>
        <div className="text-xs text-muted-c">
          {!mounted || loading ? '…' : t('debt.unpaid_count', { n: openDebts.length })}
        </div>
      </div>
      <DebtFilters active={filter} onChange={setFilter} />

      {mounted && loading ? (
        <div className="glass p-10 text-center">
          <div className="text-3xl mb-2">⏳</div>
          <div className="text-sm text-muted-c">{t('debt.loading_debts')}</div>
        </div>
      ) : mounted && visible.length === 0 ? (
        <div className="glass p-10 text-center">
          <div className="text-5xl mb-3">🌿</div>
          <div className="font-bold text-lg mb-1">{t('debt.congrats')}</div>
          <div className="text-sm text-muted-c">
            {openDebts.length === 0
              ? t('debt.all_closed')
              : t('debt.none_in_category')}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((d) => (
            <DebtCard key={d.id} debt={d} onSelect={startFlow} />
          ))}
        </div>
      )}
    </section>
  );
}

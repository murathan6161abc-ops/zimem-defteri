'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useZimemStore } from '@/store/useZimemStore';
import type { DebtKind } from '@/types';
import {
  fetchOpenDebts,
  subscribeToDebts,
} from '@/lib/supabaseDebts';
import { isSupabaseConfigured } from '@/lib/supabase';
import { SAMPLE_DEBTS, kindOf } from '@/lib/debts';
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
  const closedByMe = useZimemStore((s) => s.history.length);

  const [filter, setFilter] = useState<DebtKind | 'all'>('all');
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
        onClose: (id) => {
          // Kendi ödememizle kapanan borç listeden zaten çıkmıştır; bildirim
          // yalnızca borcu başka biri kapattığında gösterilir.
          if (applyRemoteDebtClose(id)) {
            pushToast({
              emoji: '✅',
              title: tStatic('debt.toast_closed_title'),
              desc: tStatic('debt.toast_closed_desc'),
            });
          }
        },
        onDelete: (id) => {
          // Esnaf borcu sildi: "kapandı" demek yanlış olur, listeden sessizce çıkar.
          applyRemoteDebtClose(id);
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
          : openDebts.filter((d) => kindOf(d) === filter),
    [mounted, filter, openDebts],
  );
  const kindCounts = useMemo(() => {
    const counts: Partial<Record<DebtKind, number>> = {};
    if (mounted) for (const d of openDebts) counts[kindOf(d)] = (counts[kindOf(d)] ?? 0) + 1;
    return counts;
  }, [mounted, openDebts]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h2 className="heading-lg">{t('debt.open_debts')}</h2>
        <div className="text-xs text-muted-c">
          {!mounted || loading ? '…' : t('debt.unpaid_count', { n: openDebts.length })}
        </div>
      </div>
      <DebtFilters active={filter} onChange={setFilter} counts={kindCounts} />

      {mounted && loading ? (
        <div className="glass p-10 text-center">
          <div className="text-3xl mb-2">⏳</div>
          <div className="text-sm text-muted-c">{t('debt.loading_debts')}</div>
        </div>
      ) : mounted && visible.length === 0 ? (
        <div className="glass p-10 text-center">
          {openDebts.length > 0 ? (
            // Filtre: bu kategoride borç yok
            <>
              <div className="text-4xl mb-3">🔎</div>
              <div className="text-sm text-muted-c">{t('debt.none_in_category')}</div>
            </>
          ) : closedByMe > 0 ? (
            // Havuz boş ve kullanıcı borç kapatmış: tebrik
            <>
              <div className="text-5xl mb-3">🌿</div>
              <div className="font-bold text-lg mb-1">{t('debt.congrats')}</div>
              <div className="text-sm text-muted-c">{t('debt.all_closed')}</div>
            </>
          ) : (
            // Havuz boş, yeni kullanıcı: tebrik değil, bilgi
            <>
              <div className="text-5xl mb-3">🕊️</div>
              <div className="font-bold text-lg mb-1">{t('debt.empty_pool_title')}</div>
              <div className="text-sm text-muted-c">{t('debt.empty_pool_desc')}</div>
            </>
          )}
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

'use client';
// Yönetici: takip edilecek gerçek ödemeler. Uygulama bankayı göremediği için anlaşmazlık
// uygulama dışında çözülür: esnaf aranır, ödeyen kişi dekontunu ekibe gösterir. Dekont
// uygulamaya yüklenmez; burada yalnızca kod, tutar ve tarihler görünür.
import { useCallback, useEffect, useState } from 'react';
import { daysWaiting, fetchStuckPledges, STUCK_AFTER_DAYS, type Pledge } from '@/lib/pledges';
import { formatTL } from '@/lib/debts';

function fmt(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—';
}

export default function StuckPledgesPanel() {
  const [pledges, setPledges] = useState<Pledge[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    const rows = await fetchStuckPledges();
    setUnavailable(rows === null);
    setPledges(rows ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Göç çalıştırılmamışsa doğrulama paneli zaten uyarı gösterir.
  if (unavailable) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="heading-lg">Takılan ödemeler</h2>
        <button type="button" className="btn" onClick={() => void load()}>
          Yenile
        </button>
      </div>
      <p className="text-xs text-muted-c mb-3">
        {STUCK_AFTER_DAYS} günden uzun süredir esnaf onayı bekleyen ve son 30 günde esnafın “almadım” dediği
        ödemeler. Esnafı arayın; ödeyen kişi dekontunu ve ödeme kodunu size göstersin. Dekontu uygulamaya yüklemeyin.
      </p>
      {pledges === null ? (
        <div className="glass p-6 text-center text-sm text-muted-c">Yükleniyor…</div>
      ) : pledges.length === 0 ? (
        <div className="glass p-6 text-center text-sm text-muted-c">Takılan ödeme yok.</div>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-c">
                <th className="p-2">Kod</th>
                <th className="p-2">Durum</th>
                <th className="p-2">Tutar</th>
                <th className="p-2">Yöntem</th>
                <th className="p-2">Borç / esnaf</th>
                <th className="p-2">Kod alındı</th>
                <th className="p-2">Gönderildi</th>
              </tr>
            </thead>
            <tbody>
              {pledges.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="p-2 font-mono">{p.code}</td>
                  <td className="p-2">
                    {p.status === 'rejected' ? (
                      <span className="text-rose-300">Esnaf “almadım” dedi · {fmt(p.resolvedAt)}</span>
                    ) : (
                      <span className="text-amber-200">{daysWaiting(p)} gündür bekliyor</span>
                    )}
                  </td>
                  <td className="p-2 tabular-nums">{formatTL(p.amount)}</td>
                  <td className="p-2">{p.method === 'havale' ? 'Havale' : 'Dükkânda'}</td>
                  <td className="p-2">
                    <div>{p.debtTitle ?? '—'}</div>
                    <div className="text-xs text-muted-c">
                      {p.merchantName ?? 'Anonim Esnaf'}
                      {p.city && ` · ${p.city}`}
                    </div>
                  </td>
                  <td className="p-2">{fmt(p.createdAt)}</td>
                  <td className="p-2">{p.sentAt ? `📩 ${fmt(p.sentAt)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

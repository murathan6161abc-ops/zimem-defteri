'use client';
import { CATEGORY_META } from '@/lib/debts';
import type { Category } from '@/types';
import type { SubmissionRow } from '@/app/admin/page';

const CATS: Category[] = ['gida', 'egitim', 'fatura', 'saglik'];

export default function AdminCharts({ rows }: { rows: SubmissionRow[] }) {
  const total = rows.length;
  const totalAmount = rows.reduce((a, b) => a + b.debt_amount, 0);
  const totalXP = rows.reduce((a, b) => a + b.xp_gained, 0);
  const uniqueParticipants = new Set(rows.map((r) => r.user_id)).size;
  const avgXP = total ? Math.round(totalXP / total) : 0;
  const willRepeatYes = rows.filter((r) => r.will_repeat === 'evet').length;
  const repeatRate = total ? Math.round((willRepeatYes / total) * 100) : 0;

  // Pre→Post Likert
  const avgPreLikert = total
    ? (rows.reduce((a, b) => a + (b.pre_likert || 0), 0) / total).toFixed(2)
    : '0';
  const avgPostLikert = total
    ? (rows.reduce((a, b) => a + (b.post_likert || 0), 0) / total).toFixed(2)
    : '0';

  // Kategori dağılımı
  const catCounts = CATS.map(
    (c) => rows.filter((r) => r.debt_category === c).length,
  );
  const catMax = Math.max(1, ...catCounts);

  // Günlük zaman serisi (son 30 gün)
  // created_at UTC ISO; yerel güne göre grupla — aksi halde toISOString
  // UTC+3'te günü kaydırıp etiketleri veriyle uyumsuz yapıyor ve bugünün
  // gönderimlerini hiçbir kovaya düşürmüyordu.
  const localDayKey = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const buckets: { day: string; count: number; xp: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = localDayKey(d);
    const dayRows = rows.filter((r) => localDayKey(new Date(r.created_at)) === key);
    buckets.push({
      day: d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
      count: dayRows.length,
      xp: dayRows.reduce((a, b) => a + b.xp_gained, 0),
    });
  }
  const bucketMax = Math.max(1, ...buckets.map((b) => b.count));

  // Duygu dağılımları
  const preEmotionCounts: Record<string, number> = {};
  const postEmotionCounts: Record<string, number> = {};
  for (const r of rows) {
    if (r.pre_emotion) preEmotionCounts[r.pre_emotion] = (preEmotionCounts[r.pre_emotion] || 0) + 1;
    if (r.post_emotion) postEmotionCounts[r.post_emotion] = (postEmotionCounts[r.post_emotion] || 0) + 1;
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Toplam Anket" value={total} color="text-amber-300" />
        <Stat label="Katılımcı" value={uniqueParticipants} color="text-blue-300" />
        <Stat label="Toplam Bağış" value={`${totalAmount} ₺`} color="text-emerald-300" />
        <Stat label="Ort. XP / Anket" value={avgXP} color="text-purple-300" />
        <Stat label="Pre Likert (Ort)" value={avgPreLikert} color="text-pink-300" />
        <Stat label="Post Likert (Ort)" value={avgPostLikert} color="text-pink-300" />
        <Stat label="Tekrar Niyeti" value={`${repeatRate}% evet`} color="text-amber-300" />
        <Stat label="Toplam XP" value={totalXP} color="text-amber-300" />
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-5">
        {/* Günlük gönderim */}
        <div className="glass p-4">
          <div className="section-title">Günlük Anket Gönderimi (30 gün)</div>
          <svg viewBox="0 0 720 180" className="w-full">
            {buckets.map((b, i) => {
              const h = (b.count / bucketMax) * 140;
              const x = 10 + i * 23;
              const y = 160 - h;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={18} height={h} rx={3} fill="#fbbf24" opacity={0.85} />
                  {(i % 5 === 0 || i === 29) && (
                    <text x={x + 9} y={175} fontSize={9} fill="#9aa6c1" textAnchor="middle">
                      {b.day}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Kategori dağılımı */}
        <div className="glass p-4">
          <div className="section-title">Kategori Dağılımı</div>
          <div className="space-y-3 mt-2">
            {CATS.map((c, i) => {
              const meta = CATEGORY_META[c];
              const value = catCounts[i];
              const pct = (value / catMax) * 100;
              return (
                <div key={c}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>
                      <span className={`category-chip cat-${c}`}>
                        {meta.emoji} {meta.label}
                      </span>
                    </span>
                    <span className="text-muted-c">
                      {value} ({total ? Math.round((value / total) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-5">
        <EmotionPanel
          title="Pre-test duyguları (Niyet)"
          counts={preEmotionCounts}
          color="#a855f7"
        />
        <EmotionPanel
          title="Post-test duyguları (Etki)"
          counts={postEmotionCounts}
          color="#10b981"
        />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color} truncate`}>{value}</div>
    </div>
  );
}

function EmotionPanel({
  title,
  counts,
  color,
}: {
  title: string;
  counts: Record<string, number>;
  color: string;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  return (
    <div className="glass p-4">
      <div className="section-title">{title}</div>
      {entries.length === 0 ? (
        <div className="text-xs text-muted-c py-4 text-center">Veri yok</div>
      ) : (
        <div className="space-y-2 mt-2">
          {entries.map(([k, v]) => {
            const pct = (v / total) * 100;
            return (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-24 capitalize">{k}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="w-12 text-right text-muted-c">{v}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

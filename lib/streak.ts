// Seri (art arda iyilik günleri) hesabı
// Günler UTC'ye göre değil, kullanıcının yerel takvimine göre sayılır:
// UTC+3'te gece yarısından sonraki işlem yeni bir gündür.

/** Yerel takvim günü (YYYY-MM-DD). */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeStreak(prevDate: string | null, prevStreak: number, today: Date) {
  const todayKey = dayKey(today);
  if (!prevDate) return { streak: 1, dateKey: todayKey };
  if (prevDate === todayKey) return { streak: Math.max(1, prevStreak), dateKey: todayKey };
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (prevDate === dayKey(yesterday)) return { streak: prevStreak + 1, dateKey: todayKey };
  return { streak: 1, dateKey: todayKey };
}

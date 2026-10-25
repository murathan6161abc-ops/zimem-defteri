'use client';
import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { isAdminUser, signIn, signOut } from '@/lib/auth';
import { sessionNeedsMfa } from '@/lib/accountSecurity';
import MfaCodeForm from '@/components/auth/MfaCodeForm';
import type { Session } from '@supabase/supabase-js';
import { CATEGORY_META } from '@/lib/debts';
import type { Category } from '@/types';
import AdminCharts from '@/components/admin/AdminCharts';
import ResearchReportPanel from '@/components/admin/ResearchReportPanel';

export interface SubmissionRow {
  id: string;
  user_id: string;
  display_name: string | null;
  city: string | null;
  debt_id: string;
  debt_title: string;
  debt_category: Category;
  debt_amount: number;
  debt_urgency: number;
  debt_added_by: string | null;
  pre_huzur: number | null;
  pre_emotion: string | null;
  pre_emotion_value: number | null;
  pre_likert: number | null;
  post_emotion: string | null;
  post_emotion_value: number | null;
  post_likert: number | null;
  post_huzur: number | null;
  will_repeat: string | null;
  xp_gained: number;
  app_version: string | null;
  created_at: string;
  // PANAS toplamları; bölüm atlandıysa null
  panas_neg_total: number | null;
  panas_pos_total: number | null;
}

type AccessState = 'checking' | 'signed_out' | 'mfa' | 'forbidden' | 'authorized';

// CSV dışa aktarma (Excel, SPSS, JASP)
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const raw = String(v);
  // Excel/LibreOffice formül enjeksiyonunu engelle.
  const s = /^[\t\r\n]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// APK'nın WebView'inde blob + <a download> sessizce başarısız olabiliyor; orada içerik
// panoya kopyalanır. Web'de dosya indirilir.
function exportOrCopy(isCapacitor: boolean, filename: string, content: string, mime: string): void {
  if (isCapacitor) {
    void navigator.clipboard
      .writeText(content)
      .then(() => alert(`${filename} içeriği panoya kopyalandı. Bir not/e-posta uygulamasına yapıştırabilirsin.`))
      .catch(() => alert('Panoya kopyalama başarısız oldu.'));
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsToCSV(rows: SubmissionRow[]): string {
  const cols: (keyof SubmissionRow)[] = [
    'created_at', 'user_id', 'display_name', 'city',
    'debt_category', 'debt_amount', 'debt_urgency',
    'pre_huzur', 'pre_emotion', 'pre_emotion_value', 'pre_likert',
    'post_huzur', 'post_emotion', 'post_emotion_value', 'post_likert', 'will_repeat',
    'panas_neg_total', 'panas_pos_total',
    'xp_gained', 'app_version',
  ];
  const header = cols.join(',');
  const lines = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','));
  return [header, ...lines].join('\n');
}

export default function AdminPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [access, setAccess] = useState<AccessState>('checking');
  const [loginBusy, setLoginBusy] = useState(false);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [days, setDays] = useState<number>(30);
  const [isCapacitor, setIsCapacitor] = useState(false);

  useEffect(() => {
    setIsCapacitor(typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: unknown }).Capacitor);
    const sb = getSupabase();
    if (!sb) {
      setAccess('signed_out');
      return;
    }

    let active = true;
    // 2FA'lı hesapta şifre tek başına yetmez: önce kod (aal2), sonra yetki kontrolü.
    const applySession = (session: Session | null) => {
      if (!active) return;
      const user = session?.user;
      if (!user) return setAccess('signed_out');
      if (sessionNeedsMfa(session)) return setAccess('mfa');
      setAccess(isAdminUser(user) ? 'authorized' : 'forbidden');
    };

    void sb.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: authSubscription } = sb.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (access !== 'authorized') return;
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, days]);

  async function loadRows() {
    if (!isSupabaseConfigured()) {
      setError('Supabase ayarlanmamış. .env.local dosyasındaki URL ve publishable key değerlerini kontrol et.');
      return;
    }
    setLoading(true);
    setError(null);
    const sb = getSupabase()!;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error: err } = await sb
      .from('survey_submissions')
      .select('id, user_id, display_name, city, debt_id, debt_title, debt_category, debt_amount, debt_urgency, debt_added_by, pre_huzur, pre_emotion, pre_emotion_value, pre_likert, post_huzur, post_emotion, post_emotion_value, post_likert, will_repeat, panas_neg_total, panas_pos_total, xp_gained, app_version, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (err) {
      setError(err.message);
    } else {
      setRows((data as SubmissionRow[]) || []);
    }
    setLoading(false);
  }

  async function tryLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || password.length < 6 || loginBusy) return;

    setLoginBusy(true);
    setError(null);
    const result = await signIn(username, password);
    setPassword('');

    if (!result.ok || !result.user) {
      setError('Kullanıcı adı veya şifre yanlış.');
      setLoginBusy(false);
      return;
    }

    const { data: sessionData } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
    if (sessionNeedsMfa(sessionData.session)) {
      setAccess('mfa');
      setLoginBusy(false);
      return;
    }

    if (!isAdminUser(result.user)) {
      await signOut();
      setAccess('forbidden');
      setError('Bu hesapta yönetici yetkisi yok.');
      setLoginBusy(false);
      return;
    }

    setAccess('authorized');
    setLoginBusy(false);
  }

  if (access === 'mfa') {
    return (
      <div className="pt-10 max-w-md mx-auto">
        <div className="glass-strong p-6">
          {/* Doğrulama sonrası onAuthStateChange yeni (aal2) oturumla erişimi yeniden hesaplar. */}
          <MfaCodeForm
            onVerified={() => undefined}
            onCancel={async () => {
              await signOut();
              setAccess('signed_out');
            }}
          />
        </div>
      </div>
    );
  }

  if (access === 'checking') {
    return <div className="pt-10 text-center text-sm text-muted-c">Yetki kontrol ediliyor…</div>;
  }

  if (access !== 'authorized') {
    return (
      <div className="pt-10 max-w-md mx-auto">
        <form onSubmit={tryLogin} className="glass-strong p-6">
          <div className="text-center mb-5">
            <h1 className="heading-lg">Yönetici girişi</h1>
            <p className="text-xs text-muted-c">Yetkili Supabase hesabıyla giriş yap.</p>
          </div>
          <input
            type="text"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Kullanıcı adı veya e-posta"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:bg-white/10 outline-none text-sm"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            className="w-full px-4 py-3 mt-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:bg-white/10 outline-none text-sm"
          />
          {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
          <button type="submit" className="btn btn-primary w-full mt-4" disabled={loginBusy}>
            {loginBusy ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
      </div>
    );
  }

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.debt_category === filter);

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="heading-xl">Yönetim paneli</h1>
          <p className="text-xs text-muted-c">
            {loading ? 'Yükleniyor…' : `${rows.length} anket gönderimi · son ${days} gün`}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
          >
            <option value={1}>Son 24 saat</option>
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
            <option value={3650}>Tümü</option>
          </select>
          <button type="button" className="btn" onClick={loadRows}>
            Yenile
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => exportOrCopy(isCapacitor, `zimem-anket-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(rows, null, 2), 'application/json')}
          >
            {isCapacitor ? 'JSON kopyala' : 'JSON indir'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              // UTF-8 BOM: Excel Türkçe karakterleri doğru göstersin diye
              const csv = String.fromCharCode(0xfeff) + rowsToCSV(rows);
              exportOrCopy(isCapacitor, `zimem-anket-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8;');
            }}
          >
            {isCapacitor ? 'CSV kopyala' : 'CSV indir'}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass p-4 mb-4 border-red-400/30 text-red-300 text-sm">{error}</div>
      )}

      <div className="flex gap-2 flex-wrap mb-4">
        {(['all', 'gida', 'egitim', 'fatura', 'saglik'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`tab-btn ${filter === c ? 'active' : ''}`}
          >
            {c === 'all' ? 'Tümü' : CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      <AdminCharts rows={filtered} />

      <h2 className="heading-lg mt-6 mb-3">Anket tablosu</h2>
      <div className="glass overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-c">
            <tr className="border-b border-white/10">
              <th className="text-left p-3">Tarih</th>
              <th className="text-left p-3">Kim</th>
              <th className="text-left p-3">Şehir</th>
              <th className="text-left p-3">Borç</th>
              <th className="text-right p-3">Tutar</th>
              <th className="text-center p-3">Aciliyet</th>
              <th className="text-left p-3">Ön test (duygu · madde · huzur)</th>
              <th className="text-left p-3">Son test (duygu · madde · huzur)</th>
              <th className="text-left p-3">Tekrar</th>
              <th className="text-right p-3">XP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="p-3 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="p-3">{r.display_name || '—'}</td>
                <td className="p-3">{r.city || '—'}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className={`urgency-dot dot-${r.debt_category}`} title={CATEGORY_META[r.debt_category].label} />
                    <span className="truncate max-w-[180px] inline-block">{r.debt_title}</span>
                  </div>
                </td>
                <td className="p-3 text-right text-amber-200">{r.debt_amount} ₺</td>
                <td className="p-3 text-center">
                  <span className={`urgency-dot urgency-${r.debt_urgency}`} />
                </td>
                <td className="p-3 whitespace-nowrap">
                  {r.pre_emotion || '—'} · {r.pre_likert ?? '—'} · {r.pre_huzur ?? '—'}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {r.post_emotion || '—'} · {r.post_likert ?? '—'} · {r.post_huzur ?? '—'}
                </td>
                <td className="p-3">{r.will_repeat || '—'}</td>
                <td className="p-3 text-right text-amber-300 font-bold">+{r.xp_gained}</td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="text-center text-muted-c p-8">
                  Veri yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ResearchReportPanel rows={filtered} isCapacitor={isCapacitor} />
    </div>
  );
}

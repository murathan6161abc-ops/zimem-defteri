// ============================================================
// Veresiye defteri tarama — istemci tarafı
// ────────────────────────────────────────────────────────────
// 1. Fotoğrafı cihazda küçültür (≤2000 px JPEG) → hızlı yükleme
// 2. Supabase'deki scan_jobs kuyruğuna "pending" iş olarak yazar
// 3. Yöneticinin bilgisayarındaki tarama programı (yerel Ollama modeli) işi
//    okur, sonucu yazar ve fotoğrafı siler; uygulama sonucu bekleyip alır
// 4. Müşteri baş harflerini YALNIZCA bu cihazda saklar (sunucuya gitmez)
// Fotoğraf hiçbir yapay zekâ şirketine (Google vb.) gönderilmez.
// ============================================================

import { getSupabase } from './supabase';
import { getCurrentUserId } from './auth';
import { cleanEntries, toInitials, type ScannedEntry } from './ledgerParse';

export type { ScannedEntry } from './ledgerParse';

export type ScanErrorCode =
  | 'not_configured' // Supabase ya da kuyruk tabloları kurulmamış
  | 'offline' // tarama bilgisayarı kapalı / program çalışmıyor
  | 'rate_limited' // günlük 30 tarama sınırı
  | 'bad_image'
  | 'ocr_failed'
  | 'network'
  | 'generic';

export type ScanResult =
  | { ok: true; entries: ScannedEntry[]; warning: string }
  | { ok: false; error: ScanErrorCode };

export type ScanStage = 'uploading' | 'queued' | 'processing';

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.85;

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // EXIF yönünü uygula — telefon fotoğrafları yan dönmesin.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Eski WebView'ler için yedek yol.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Görseli en fazla 2000 px'e küçültüp base64 JPEG döndürür (data: öneki olmadan). */
export async function compressImage(file: Blob): Promise<string> {
  const source = await loadBitmap(file);
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!width || !height) throw new Error('empty image');

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!base64) throw new Error('encode failed');
  return base64;
}


// Bilgisayar 45 sn içinde işi almazsa nabzına bakılır: kapalıysa iş iptal edilir;
// açıksa (başka esnafın sayfasını okuyordur) 150 sn'ye kadar sırada beklenir.
// Aldıktan sonra model ilk yüklemede yavaş olabileceği için 3 dakika tanınır.
// (Tarama programı 3 dakikadan eski bekleyen işleri zaten okumaz.)
const PICKUP_TIMEOUT_MS = 45_000;
const BUSY_PICKUP_TIMEOUT_MS = 150_000;
const PROCESS_TIMEOUT_MS = 180_000;
const POLL_MS = 2_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface JobRow {
  status: 'pending' | 'processing' | 'done' | 'failed';
  result: unknown;
  error: string | null;
}

function mapDbError(error: { code?: string; message?: string } | null): ScanErrorCode {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  if (code === '42501' || msg.includes('row-level security')) return 'rate_limited';
  if (code === 'PGRST205' || code === '42P01' || msg.includes('could not find the table')) return 'not_configured';
  if (code === '23514') return 'bad_image';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) return 'network';
  return 'generic';
}

/** Tarama bilgisayarı çevrimiçi mi? (sunucu saatiyle, son 60 sn içinde nabız) */
export async function getScannerStatus(): Promise<{ online: boolean; model: string | null } | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('scan_worker_status');
    if (error || !data || typeof data !== 'object') return null;
    const d = data as { online?: unknown; model?: unknown };
    return { online: d.online === true, model: typeof d.model === 'string' ? d.model : null };
  } catch {
    return null;
  }
}

async function cancelJob(id: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  try {
    // RLS: sahip yalnızca bekleyen işini "failed + fotoğraf silinmiş" yapabilir.
    await client.from('scan_jobs').update({ status: 'failed', image: null }).eq('id', id).eq('status', 'pending');
  } catch {}
}

export async function scanLedgerPage(file: Blob, onStage?: (stage: ScanStage) => void): Promise<ScanResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };

  let image: string;
  try {
    image = await compressImage(file);
  } catch {
    return { ok: false, error: 'bad_image' };
  }

  onStage?.('uploading');
  let jobId: string;
  try {
    const { data, error } = await client
      .from('scan_jobs')
      .insert({ user_id: getCurrentUserId(), image, mime_type: 'image/jpeg' })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: mapDbError(error) };
    jobId = String((data as { id: string }).id);
  } catch (e) {
    return { ok: false, error: mapDbError(e instanceof Error ? { message: e.message } : null) };
  }

  onStage?.('queued');
  const startedAt = Date.now();
  let pickedAt: number | null = null;
  let networkErrors = 0;

  for (;;) {
    await sleep(POLL_MS);
    let row: JobRow | null = null;
    try {
      const { data, error } = await client
        .from('scan_jobs')
        .select('status, result, error')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw error;
      row = data as JobRow | null;
      networkErrors = 0;
    } catch {
      // Kısa bağlantı kopmalarında hemen vazgeçme.
      if (++networkErrors >= 5) return { ok: false, error: 'network' };
      continue;
    }
    if (!row) return { ok: false, error: 'generic' };

    if (row.status === 'done') {
      const result = (row.result ?? {}) as { warning?: unknown };
      return {
        ok: true,
        entries: cleanEntries(row.result),
        warning: typeof result.warning === 'string' ? result.warning.slice(0, 300) : '',
      };
    }
    if (row.status === 'failed') {
      return { ok: false, error: row.error === 'bad_image' ? 'bad_image' : 'ocr_failed' };
    }
    if (row.status === 'processing' && pickedAt === null) {
      pickedAt = Date.now();
      onStage?.('processing');
    }
    const waited = Date.now() - startedAt;
    if (pickedAt === null && waited > PICKUP_TIMEOUT_MS) {
      const status = waited > BUSY_PICKUP_TIMEOUT_MS ? null : await getScannerStatus();
      if (!status?.online) {
        await cancelJob(jobId);
        return { ok: false, error: 'offline' };
      }
    }
    if (pickedAt !== null && Date.now() - pickedAt > PROCESS_TIMEOUT_MS) {
      return { ok: false, error: 'ocr_failed' };
    }
  }
}

export function scanErrorKey(code: ScanErrorCode): string {
  return `scan.err_${code}`;
}

// ─── Müşteri baş harfleri: yalnızca bu cihazda ────────────────
// Borç havuzu tüm kullanıcılara açıktır; kimlik ipucu ASLA sunucuya yazılmaz.
// Esnaf, bir borç kapandığında fiziksel defterde hangi müşteriyi sileceğini
// bu yerel etiketten anlar.
const REFS_KEY = 'd-zimem-ledger-refs';

export function readLedgerRefs(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REFS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveLedgerRef(debtId: string, ref: string): void {
  if (typeof window === 'undefined' || !ref.trim()) return;
  try {
    const refs = readLedgerRefs();
    const initials = toInitials(ref);
    if (!initials) return;
    refs[debtId] = initials;
    window.localStorage.setItem(REFS_KEY, JSON.stringify(refs));
  } catch {}
}

export function forgetLedgerRef(debtId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const refs = readLedgerRefs();
    if (!(debtId in refs)) return;
    delete refs[debtId];
    window.localStorage.setItem(REFS_KEY, JSON.stringify(refs));
  } catch {}
}

export function clearLedgerRefs(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(REFS_KEY);
  } catch {}
}

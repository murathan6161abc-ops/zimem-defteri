// ============================================================
// Veresiye defteri tarama — istemci tarafı
// ────────────────────────────────────────────────────────────
// 1. Fotoğrafı cihazda küçültür (≤2000 px JPEG) ve karanlık/bulanıksa uyarır
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
  | { ok: true; entries: ScannedEntry[]; warning: string; warningCode: string }
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

export interface PreparedImage {
  base64: string; // JPEG, data: öneki olmadan
  dark: boolean;
  blurry: boolean;
}

// Kalite eşikleri bilerek temkinli: yalnızca belirgin karanlık/bulanık fotoğrafta uyarır
// (uyarı gönderimi engellemez). Ölçüm ≤800 px gri tonlu kopyada yapılır.
const QUALITY_SIZE = 800;
const DARK_P80 = 60; // en aydınlık %20'lik kısım bile bundan koyuysa karanlık
const BLURRY_LAPLACIAN_VAR = 50; // keskinlik (Laplace varyansı) bundan düşükse bulanık

function measureQuality(source: CanvasImageSource, width: number, height: number): { dark: boolean; blurry: boolean } {
  try {
    const scale = Math.min(1, QUALITY_SIZE / Math.max(width, height));
    const w = Math.max(3, Math.round(width * scale));
    const h = Math.max(3, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { dark: false, blurry: false };
    ctx.drawImage(source, 0, 0, w, h);
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8ClampedArray(w * h);
    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) {
      const v = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000;
      gray[i] = v;
      hist[gray[i]]++;
    }
    let acc = 0;
    let p80 = 255;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= gray.length * 0.8) {
        p80 = v;
        break;
      }
    }
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = Math.min(255, Math.max(0, gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i] + 128));
        sum += lap;
        sumSq += lap * lap;
        n++;
      }
    }
    const variance = n ? sumSq / n - (sum / n) ** 2 : 0;
    return { dark: p80 < DARK_P80, blurry: variance < BLURRY_LAPLACIAN_VAR };
  } catch {
    return { dark: false, blurry: false };
  }
}

/** Görseli en fazla 2000 px'e küçültür (base64 JPEG) ve karanlık/bulanık olup olmadığına bakar. */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
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
  const quality = measureQuality(canvas, canvas.width, canvas.height);
  if ('close' in source) source.close();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!base64) throw new Error('encode failed');
  return { base64, ...quality };
}

// Bilgisayar 45 sn içinde işi almazsa nabzına bakılır: kapalıysa iş iptal edilir;
// açıksa (başka sayfaları okuyordur) 240 sn'ye kadar sırada beklenir.
// Aldıktan sonra model ilk yüklemede yavaş olabileceği için 3 dakika tanınır.
// (Tarama programı 3 dakikadan eski bekleyen işleri zaten okumaz.)
const PICKUP_TIMEOUT_MS = 45_000;
const BUSY_PICKUP_TIMEOUT_MS = 240_000; // sırada birkaç sayfa olabilir (sayfa başı ~40 sn)
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

/** Fotoğrafı kuyruğa yazar (image: prepareImage() ile hazırlanmış base64 JPEG). */
export async function submitScan(
  image: string,
): Promise<{ ok: true; jobId: string; createdAt: number } | { ok: false; error: ScanErrorCode }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  if (!image) return { ok: false, error: 'bad_image' };
  try {
    const { data, error } = await client
      .from('scan_jobs')
      .insert({ user_id: getCurrentUserId(), image, mime_type: 'image/jpeg' })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: mapDbError(error) };
    return { ok: true, jobId: String((data as { id: string }).id), createdAt: Date.now() };
  } catch (e) {
    return { ok: false, error: mapDbError(e instanceof Error ? { message: e.message } : null) };
  }
}

/**
 * Kuyruktaki işin sonucunu bekler. Süreler işin gönderildiği andan (createdAt)
 * sayılır; böylece uygulama kapanıp açıldığında kaldığı yerden devam edilebilir.
 * shouldStop true dönerse (ör. hesaptan çıkıldı) bekleme sessizce bırakılır.
 */
export async function waitForScan(
  jobId: string,
  opts: { createdAt: number; onStage?: (stage: ScanStage) => void; shouldStop?: () => boolean },
): Promise<ScanResult | null> {
  const client = getSupabase();
  if (!client) return { ok: false, error: 'not_configured' };
  let pickedAt: number | null = null;
  let networkErrors = 0;
  opts.onStage?.('queued');

  for (;;) {
    await sleep(POLL_MS);
    if (opts.shouldStop?.()) return null;
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
      const result = (row.result ?? {}) as { warning?: unknown; warning_code?: unknown };
      return {
        ok: true,
        entries: cleanEntries(row.result),
        warning: typeof result.warning === 'string' ? result.warning.slice(0, 300) : '',
        warningCode: typeof result.warning_code === 'string' ? result.warning_code.slice(0, 40) : '',
      };
    }
    if (row.status === 'failed') {
      return { ok: false, error: row.error === 'bad_image' ? 'bad_image' : row.error === 'expired' ? 'offline' : 'ocr_failed' };
    }
    if (row.status === 'processing' && pickedAt === null) {
      pickedAt = Date.now();
      opts.onStage?.('processing');
    }
    const waited = Date.now() - opts.createdAt;
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
    // Yarım kalmış tarama oturumu (inceleme listesi) da bir sonraki kişiye kalmasın.
    window.localStorage.removeItem(SCAN_SESSION_KEY);
    window.dispatchEvent(new Event(SCAN_RESET_EVENT));
  } catch {}
}

export const SCAN_SESSION_KEY = 'd-zimem-scan-session-v1';
export const SCAN_RESET_EVENT = 'd-zimem-scan-reset';

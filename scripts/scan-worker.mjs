#!/usr/bin/env node
// D-Zimem — Tarama bilgisayarı
// Supabase'deki scan_jobs kuyruğunu izler; esnafın gönderdiği veresiye defteri
// fotoğrafını BU bilgisayardaki yerel görsel modelle (Ollama) okur, sonucu
// yazar ve fotoğrafı veritabanından siler. Fotoğraf hiçbir yapay zekâ
// şirketine gitmez. Bilgisayar dışarıya port açmaz; yalnızca Supabase'e bağlanır.
//
//   npm run tarama:kurulum   → tarama hesabını oluşturur (.env.tarama)
//   npm run tarama           → programı başlatır; açık kaldığı sürece tarama çalışır
//
// Ayarlar (.env.tarama, isteğe bağlı olanlar):
//   OLLAMA_MODEL  varsayılan qwen3.5:9b
//   OLLAMA_URL    varsayılan http://127.0.0.1:11434

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { NUM_CTX, READER_VERSION, readLedger } from './ledger-reader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USERNAME_DOMAIN = 'dzimem.app';

const POLL_MS = 2_000;
const HEARTBEAT_MS = 20_000;
const CLEANUP_MS = 30 * 60_000;
const STALE_JOB_MS = 5 * 60_000; // telefon sırada en fazla 4 dk bekler; daha eskisini okumaya değmez
const OLLAMA_TIMEOUT_MS = 170_000; // uygulama 180 sn bekler (kalabalık sayfa ~60 sn)
const KEEP_DAYS = 3;

// Ayarlar
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const ENV_FILE = process.env.TARAMA_ENV_FILE || path.join(ROOT, '.env.tarama');
const env = { ...readEnvFile(path.join(ROOT, '.env.local')), ...readEnvFile(ENV_FILE), ...process.env };

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const WORKER_USERNAME = (env.TARAMA_KULLANICI || 'tarama_bilgisayari').toLowerCase();
const WORKER_EMAIL = `${WORKER_USERNAME}@${USERNAME_DOMAIN}`;
const OLLAMA_URL = (env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OLLAMA_MODEL = env.OLLAMA_MODEL || 'qwen3.5:9b';

const time = () => new Date().toLocaleTimeString('tr-TR');
const log = (...a) => console.log(`[${time()}]`, ...a);
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!SUPABASE_URL || !SUPABASE_KEY) {
  fail('Supabase adresi/anahtarı bulunamadı. Proje klasöründe .env.local dosyası olmalı.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
});

// Kurulum: tarama hesabını oluştur
async function setup() {
  console.log(`Sunucu: ${new URL(SUPABASE_URL).host}`);
  if (env.TARAMA_SIFRE) {
    console.log(`\nTarama hesabı zaten kurulu: ${WORKER_USERNAME}  (${path.basename(ENV_FILE)})`);
    printRoleHelp();
    return;
  }
  const password = crypto.randomBytes(18).toString('base64url');
  const now = new Date().toISOString();
  const { data, error } = await supabase.auth.signUp({
    email: WORKER_EMAIL,
    password,
    options: {
      data: { username: WORKER_USERNAME, role: 'vatandas', displayName: 'Tarama Bilgisayarı', createdAt: now, consentAt: now },
    },
  });
  if (error) fail(`Hesap oluşturulamadı: ${error.message}`);
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    fail(`"${WORKER_USERNAME}" kullanıcı adı zaten alınmış. .env.tarama içine TARAMA_KULLANICI=baska_ad yazıp tekrar dene.`);
  }
  fs.writeFileSync(
    ENV_FILE,
    [
      '# D-Zimem tarama bilgisayarı — GİZLİ, kimseyle paylaşma, git\'e ekleme.',
      `TARAMA_KULLANICI=${WORKER_USERNAME}`,
      `TARAMA_SIFRE=${password}`,
      `OLLAMA_MODEL=${OLLAMA_MODEL}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  console.log(`\n✓ Tarama hesabı oluşturuldu: ${WORKER_USERNAME}`);
  console.log(`  Giriş bilgileri ${path.basename(ENV_FILE)} dosyasına kaydedildi (yalnızca bu bilgisayarda).`);
  printRoleHelp();
}

function printRoleHelp() {
  console.log(`
Sıradaki adım — hesaba tarama yetkisi ver:
  Supabase → SQL Editor'de supabase/assign_scan_worker.sql.example dosyasını çalıştır.
Sonra programı başlat:
  npm run tarama
`);
}

// Ollama
async function checkOllama() {
  let tags;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    tags = await res.json();
  } catch {
    fail(`Ollama'ya ulaşılamadı (${OLLAMA_URL}). Ollama uygulamasını aç ya da terminalde "ollama serve" çalıştır.`);
  }
  const names = (tags.models ?? []).map((m) => m.name);
  if (!names.includes(OLLAMA_MODEL) && !names.includes(`${OLLAMA_MODEL}:latest`)) {
    fail(`"${OLLAMA_MODEL}" modeli bu bilgisayarda yok. Önce şunu çalıştır:  ollama pull ${OLLAMA_MODEL}`);
  }
}

async function warmUp() {
  // Modeli belleğe yükle; ilk tarama beklemesin.
  try {
    await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Model, taramada kullanılan bağlam boyutuyla yüklensin (yoksa ilk taramada yeniden yüklenir).
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt: '', keep_alive: '1h', options: { num_ctx: NUM_CTX } }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {}
}

// ─── Supabase oturumu ────────────────────────────────────────
async function signIn() {
  const { data, error } = await supabase.auth.signInWithPassword({ email: WORKER_EMAIL, password: env.TARAMA_SIFRE });
  if (error) fail(`Tarama hesabıyla giriş yapılamadı: ${error.message}`);
  if (data.user?.app_metadata?.role !== 'scan_worker') {
    console.error('\n✗ Bu hesabın tarama yetkisi yok.');
    printRoleHelp();
    process.exit(1);
  }
}

// Nabız zamanlayıcısı ve iş döngüsü aynı anda yenilemesin: tek yenileme paylaşılır.
let refreshing = null;
async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  const expiresAt = (data.session?.expires_at ?? 0) * 1000;
  if (expiresAt - Date.now() > 5 * 60_000) return;
  refreshing ??= (async () => {
    const { error } = await supabase.auth.refreshSession();
    if (error) await signIn();
  })().finally(() => {
    refreshing = null;
  });
  await refreshing;
}

// İş döngüsü
async function finish(id, patch) {
  const { error } = await supabase
    .from('scan_jobs')
    .update({ ...patch, image: null, finished_at: new Date().toISOString() })
    .eq('id', id);
  if (error) log('! sonuç yazılamadı:', error.message);
}

async function processJob(job) {
  // Aynı işi iki kez almamak için yalnızca hâlâ "pending" ise üstlen.
  const { data: claimed, error: claimError } = await supabase
    .from('scan_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('id, image');
  if (claimError || !claimed?.length) return;

  const image = claimed[0].image;
  if (!image) return finish(job.id, { status: 'failed', error: 'bad_image' });

  const started = Date.now();
  log('→ yeni sayfa okunuyor…');
  try {
    const { entries, warning, warningCode, stats } = await readLedger(image, {
      url: OLLAMA_URL,
      model: OLLAMA_MODEL,
      timeoutMs: OLLAMA_TIMEOUT_MS,
    });
    await finish(job.id, {
      status: 'done',
      result: { entries, warning, warning_code: warningCode, version: READER_VERSION },
    });
    const toCheck = entries.filter((e) => e.issue).length;
    log(
      `✓ ${entries.length} borç okundu${toCheck ? `, ${toCheck} tanesi kontrol istiyor` : ''}` +
        `${warningCode ? ` (${warningCode})` : ''} · ${stats.lines} satır · ${((Date.now() - started) / 1000).toFixed(1)} sn`,
    );
  } catch (e) {
    const reason = e?.name === 'TimeoutError' ? 'timeout' : 'ocr_failed';
    await finish(job.id, { status: 'failed', error: reason });
    // Güvenlik: log'a fotoğraf ya da okunan içerik yazılmaz.
    log(`✗ okunamadı (${reason}): ${String(e?.message ?? e).slice(0, 120)}`);
  }
}

async function pollOnce() {
  const { data, error } = await supabase
    .from('scan_jobs')
    .select('id, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);
  if (error) throw error;
  for (const job of data ?? []) {
    if (Date.now() - new Date(job.created_at).getTime() > STALE_JOB_MS) {
      await finish(job.id, { status: 'failed', error: 'expired' });
      continue;
    }
    await processJob(job);
  }
}

async function heartbeat() {
  const { error } = await supabase.rpc('scan_worker_beat', { p_model: OLLAMA_MODEL });
  if (error) log('! nabız gönderilemedi:', error.message);
}

async function cleanup() {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  await supabase.from('scan_jobs').delete().lt('created_at', cutoff);
}

/**
 * macOS: program açık kaldığı sürece Mac boşta uykuya geçmesin (uyursa taramalar
 * yarıda kalır ve telefonlar bilgisayarı kapalı görür). caffeinate bu işlem
 * kapanınca kendiliğinden sonlanır. Kapak kapatılırsa Mac yine uyuyabilir.
 */
function keepAwake() {
  if (process.platform !== 'darwin') return;
  try {
    const child = spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {}
}

async function run() {
  if (!env.TARAMA_SIFRE) fail('Tarama hesabı kurulmamış. Önce çalıştır:  npm run tarama:kurulum');
  keepAwake();
  log(`Sunucu: ${new URL(SUPABASE_URL).host}  ·  Model: ${OLLAMA_MODEL}`);
  await checkOllama();
  await signIn();
  log(`Model yükleniyor: ${OLLAMA_MODEL} …`);
  await warmUp();
  await heartbeat();
  await cleanup();
  log('✓ Tarama bilgisayarı hazır. Bu pencere açık kaldığı sürece esnaflar defter tarayabilir. (Durdurmak için Ctrl+C)');

  // Nabız, okuma sürerken de gitsin: bir sayfa 20–60 sn sürebilir; nabız kesilirse
  // sırada bekleyen esnafın telefonu bilgisayarı kapalı sanıp işini iptal eder.
  setInterval(() => {
    void ensureSession()
      .then(heartbeat)
      .catch(() => {});
  }, HEARTBEAT_MS);

  let lastCleanup = Date.now();
  let failures = 0;
  for (;;) {
    try {
      await ensureSession();
      if (Date.now() - lastCleanup > CLEANUP_MS) {
        await cleanup();
        lastCleanup = Date.now();
      }
      await pollOnce();
      if (failures) log('✓ bağlantı yeniden kuruldu');
      failures = 0;
    } catch (e) {
      // İnternet kesintisi ya da Supabase duraklaması: çökme, bekleyip tekrar dene.
      if (++failures === 1 || failures % 30 === 0) log('! Supabase\'e ulaşılamıyor, tekrar denenecek:', String(e?.message ?? e).slice(0, 100));
    }
    await sleep(POLL_MS);
  }
}

process.on('SIGINT', () => {
  log('Tarama bilgisayarı kapatıldı.');
  process.exit(0);
});

if (process.argv.includes('--kurulum')) await setup();
else await run();

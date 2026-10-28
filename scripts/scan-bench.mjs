#!/usr/bin/env node
// ============================================================
// D-Zimem — Tarama doğruluk testi (yalnızca bu bilgisayarda)
// ────────────────────────────────────────────────────────────
// Klasördeki defter fotoğraflarını tarama programıyla AYNI yöntemle okur.
//   npm run tarama:test                 → tarama-test/ klasörü
//   npm run tarama:test -- ~/Desktop/defter-fotolari
//
// Doğru cevabı biliyorsan fotoğrafın yanına aynı adla .json koy; araç puanlar:
//   sayfa1.jpg + sayfa1.json →
//   { "entries": [ { "ref": "A.Y.", "amount": 130 }, { "ref": "M.K.", "amount": 90, "paid": true } ] }
// (ref: müşteri baş harfleri; paid: defterde ödenmiş/üstü çizili ise true)
//
// Gizlilik: fotoğraflar hiçbir yere gönderilmez (yalnızca yerel Ollama). tarama-test/
// klasörü git'e eklenmez; gerçek müşteri adları içeren fotoğrafları yine de paylaşma.
// ============================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readLedger } from './ledger-reader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(process.argv[2] || path.join(ROOT, 'tarama-test'));
const envFile = path.join(ROOT, '.env.tarama');
const env = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const OLLAMA_URL = (process.env.OLLAMA_URL || env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || env.OLLAMA_MODEL || 'qwen3.5:9b';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n"${dir}" klasörü oluşturuldu. İçine defter fotoğraflarını (JPEG/PNG) koyup tekrar çalıştır.\n`);
  process.exit(0);
}
const files = fs
  .readdirSync(dir)
  .filter((f) => /\.(jpe?g|png|heic)$/i.test(f))
  .sort();
if (files.length === 0) {
  console.log(`\n"${dir}" klasöründe fotoğraf yok. JPEG/PNG defter fotoğrafları koyup tekrar çalıştır.\n`);
  process.exit(0);
}

/** Uygulama gibi: en fazla 2000 px, JPEG %85 (macOS'ta sips ile). */
function loadAsApp(file) {
  const tmp = path.join(os.tmpdir(), `dzimem-test-${process.pid}.jpg`);
  try {
    execFileSync('sips', ['-Z', '2000', '-s', 'format', 'jpeg', '-s', 'formatOptions', '85', file, '--out', tmp], {
      stdio: 'ignore',
    });
    return fs.readFileSync(tmp).toString('base64');
  } catch {
    return fs.readFileSync(file).toString('base64');
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** Esnaf için zararlı hataları sayar: yanlış tutar, ödenmişi borç sanma, uydurma, atlanan. */
function score(pred, expected) {
  const exp = expected.map((e) => ({ ref: String(e.ref ?? ''), amount: Math.round(Number(e.amount)), paid: e.paid === true, used: false }));
  const got = pred.filter((p) => !p.paid).map((p) => ({ ...p, used: false }));
  const s = { expected: exp.filter((e) => !e.paid).length, correct: 0, flagged: 0, falseFlags: 0, errors: [] };
  const take = (p, e, kind) => {
    p.used = true;
    e.used = true;
    if (kind === 'correct') {
      s.correct++;
      if (p.issue) s.falseFlags++; // doğru okunmuş ama gereksiz yere "kontrol et"
      return;
    }
    if (p.issue) s.flagged++;
    s.errors.push(`${kind}: ${p.ref || '—'} ${p.amount} (doğrusu ${e.ref} ${e.amount}${e.paid ? ', ödenmiş' : ''})${p.issue ? ' [işaretli]' : ''}`);
  };
  for (const p of got) {
    const e = exp.find((x) => !x.used && !x.paid && x.ref === p.ref && x.amount === p.amount);
    if (e) take(p, e, 'correct');
  }
  for (const p of got.filter((x) => !x.used)) {
    const e = exp.find((x) => !x.used && !x.paid && x.amount === p.amount);
    if (e) take(p, e, 'correct');
  }
  for (const p of got.filter((x) => !x.used)) {
    const e = exp.find((x) => !x.used && x.ref === p.ref);
    if (e) take(p, e, e.paid ? 'ödenmişi borç sandı' : 'yanlış tutar');
  }
  for (const p of got.filter((x) => !x.used)) {
    if (p.issue) s.flagged++;
    s.errors.push(`fazladan: ${p.ref || '—'} ${p.amount}${p.issue ? ' [işaretli]' : ''}`);
  }
  for (const e of exp.filter((x) => !x.used && !x.paid)) s.errors.push(`atlandı: ${e.ref} ${e.amount}`);
  return s;
}

console.log(`Model: ${OLLAMA_MODEL}  ·  ${files.length} fotoğraf  ·  ${dir}\n`);
const total = { expected: 0, correct: 0, errors: 0, flagged: 0, falseFlags: 0, seconds: 0, scored: 0 };
for (const f of files) {
  const truthFile = path.join(dir, f.replace(/\.[^.]+$/, '.json'));
  const image = loadAsApp(path.join(dir, f));
  let result;
  try {
    result = await readLedger(image, { url: OLLAMA_URL, model: OLLAMA_MODEL });
  } catch (e) {
    console.log(`✗ ${f}: okunamadı — ${String(e?.message ?? e).slice(0, 120)}`);
    continue;
  }
  total.seconds += result.stats.seconds;
  const head = `${f}  (${result.stats.seconds.toFixed(1)} sn, ${result.stats.lines} satır)`;
  if (result.warningCode) console.log(`⚠ ${head}: ${result.warning}`);
  if (fs.existsSync(truthFile)) {
    const truth = JSON.parse(fs.readFileSync(truthFile, 'utf8'));
    const s = score(result.entries, Array.isArray(truth.entries) ? truth.entries : []);
    total.scored++;
    total.expected += s.expected;
    total.correct += s.correct;
    total.errors += s.errors.length;
    total.flagged += s.flagged;
    total.falseFlags += s.falseFlags;
    console.log(`${s.errors.length ? '✗' : '✓'} ${head}: ${s.correct}/${s.expected} doğru`);
    for (const e of s.errors) console.log(`    · ${e}`);
  } else {
    console.log(`• ${head}`);
    for (const e of result.entries) {
      const b = e.breakdown;
      const calc = b && b.debts.length + b.payments.length > 1 ? `  [${b.debts.join(' + ')}${b.payments.map((n) => ` − ${n}`).join('')}]` : '';
      const mark = e.paid ? '  (ödenmiş)' : e.issue ? `  ⚠ kontrol et (${e.issue === 'mismatch' ? `yazılı toplam ${b?.written}` : 'net değil'})` : '';
      console.log(`    ${(e.ref || '—').padEnd(7)} ${String(e.amount).padStart(7)} ₺  ${e.items.slice(0, 40)}${calc}${mark}`);
    }
  }
}
if (total.scored) {
  console.log(
    `\nSONUÇ: ${total.correct}/${total.expected} borç doğru (%${((100 * total.correct) / Math.max(1, total.expected)).toFixed(1)}), ` +
      `${total.errors} hata (${total.flagged} tanesi "kontrol et" diye işaretlendi), ` +
      `${total.falseFlags} doğru kayıt gereksiz yere işaretli, ort. ${(total.seconds / files.length).toFixed(1)} sn/sayfa`,
  );
}

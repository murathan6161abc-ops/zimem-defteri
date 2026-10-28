#!/usr/bin/env node
// ============================================================
// D-Zimem — Sentetik veresiye defteri sayfaları (tarama doğruluk testi için)
// ────────────────────────────────────────────────────────────
// Gerçek müşteri defteri kullanmadan tarama okuyucusunu ölçmek için, el yazısına benzeyen
// sistem fontlarıyla uydurma defter sayfaları ve doğru cevap dosyaları (.json) üretir.
//
//   npm run tarama:sentetik              → tarama-test/sentetik/ (8 sayfa)
//   npm run tarama:test -- tarama-test/sentetik
//
// Sayfalarda kısmi ödeme, binlik ayırıcı, üstü çizili (ödenmiş) hesap, "ödendi" notu ve
// yazılı "Kalan" satırları bulunur. Basılı font gerçek el yazısından kolaydır: buradaki
// sonuç bir üst sınırdır; gerçek el yazısıyla (sahte isimlerle) ayrıca ölçülmelidir.
// Adlar uydurmadır; klasör git'e girmez.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { toInitials } from '../lib/ledgerParse.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || path.join(ROOT, 'tarama-test', 'sentetik'));
const PAGES = Number(process.env.SAYFA || 8);

// Tekrarlanabilir rastgelelik (aynı tohum → aynı sayfalar)
let seed = 20261029;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const FIRST = ['Ahmet', 'Mehmet', 'Ayşe', 'Fatma', 'Emine', 'Hüseyin', 'Zeynep', 'Mustafa', 'Hatice', 'İbrahim', 'Şükrü', 'Gülsüm', 'Osman', 'Elif', 'Cemal', 'Derya', 'Kemal', 'Nuri', 'Sevgi', 'Ömer'];
const LAST = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Öztürk', 'Aydın', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özdemir', 'Polat', 'Erdoğan', 'Güneş', 'Bulut'];
const ITEMS = ['ekmek', 'süt', 'yumurta', 'peynir', 'deterjan', 'şeker', 'çay', 'yağ', 'makarna', 'pirinç', 'defter', 'kalem', 'ilaç', 'bez', 'sabun', 'domates', 'patates', 'un', 'bulgur', 'zeytin'];
const FONTS = ['Bradley Hand', 'Noteworthy', 'Marker Felt', 'Chalkboard SE', 'Comic Sans MS'];
const INKS = ['#1d3b8a', '#22305e', '#1b1b1b', '#3a2a6e'];

const tl = (n) => (n >= 1000 ? `${Math.floor(n / 1000)}.${String(n % 1000).padStart(3, '0')}` : String(n));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function makeCustomers(count) {
  const used = new Set();
  const customers = [];
  while (customers.length < count) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const ref = toInitials(name);
    if (used.has(ref)) continue;
    used.add(ref);
    const debts = Array.from({ length: between(1, 3) }, () => ({
      item: pick(ITEMS),
      amount: rnd() < 0.12 ? between(1, 3) * 1000 + between(0, 9) * 50 : between(2, 60) * 5,
    }));
    const total = debts.reduce((s, d) => s + d.amount, 0);
    const payment = rnd() < 0.3 && total > 40 ? Math.min(total - 5, between(1, Math.floor(total / 10)) * 5) : 0;
    const closed = rnd() < 0.2 ? pick(['cizgi', 'yazi']) : null;
    customers.push({ name, ref, debts, payment, closed, writeTotal: payment > 0 && rnd() < 0.6 });
  }
  return customers;
}

function pageSvg(customers, font, ink) {
  const width = 1240;
  const lineH = 54;
  let y = 150;
  const parts = [];
  parts.push(`<rect width="100%" height="100%" fill="#fbf8ee"/>`);
  for (let ly = 120; ly < 1750; ly += lineH) parts.push(`<line x1="40" y1="${ly + 14}" x2="${width - 40}" y2="${ly + 14}" stroke="#b9cbe0" stroke-width="2"/>`);
  parts.push(`<line x1="150" y1="0" x2="150" y2="1754" stroke="#e6a0a0" stroke-width="2"/>`);
  parts.push(`<text x="460" y="90" font-family="${font}" font-size="52" fill="${ink}">Veresiye</text>`);
  const text = (x, yy, s, size = 40) => `<text x="${x}" y="${yy}" font-family="${font}" font-size="${size}" fill="${ink}">${esc(s)}</text>`;

  for (const c of customers) {
    const top = y;
    parts.push(text(170, y, c.name, 44));
    y += lineH;
    for (const d of c.debts) {
      parts.push(text(230, y, d.item));
      parts.push(text(900, y, tl(d.amount)));
      y += lineH;
    }
    if (c.payment) {
      parts.push(text(230, y, 'ödedi'));
      parts.push(text(900, y, `-${tl(c.payment)}`));
      y += lineH;
    }
    if (c.writeTotal) {
      parts.push(text(230, y, 'Kalan'));
      parts.push(text(900, y, tl(c.debts.reduce((s, d) => s + d.amount, 0) - c.payment)));
      y += lineH;
    }
    if (c.closed === 'yazi') {
      parts.push(text(1040, top, 'ödendi', 38));
    } else if (c.closed === 'cizgi') {
      parts.push(`<line x1="160" y1="${top - 30}" x2="1080" y2="${y - lineH + 6}" stroke="${ink}" stroke-width="5"/>`);
    }
    y += 18;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1754">${parts.join('')}</svg>`;
}

fs.mkdirSync(outDir, { recursive: true });
for (let i = 1; i <= PAGES; i++) {
  const customers = makeCustomers(between(5, 8));
  const font = FONTS[(i - 1) % FONTS.length];
  const ink = pick(INKS);
  const angle = (rnd() - 0.5) * 4; // −2°…+2° hafif eğiklik
  const name = `sentetik-${String(i).padStart(2, '0')}`;
  await sharp(Buffer.from(pageSvg(customers, font, ink)))
    .rotate(angle, { background: '#f2efe4' })
    .blur(0.6)
    .modulate({ brightness: 0.96 })
    .jpeg({ quality: 85 })
    .toFile(path.join(outDir, `${name}.jpg`));
  const entries = customers.map((c) => {
    const amount = c.debts.reduce((s, d) => s + d.amount, 0) - c.payment;
    return c.closed ? { ref: c.ref, amount, paid: true } : { ref: c.ref, amount };
  });
  fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify({ font, entries }, null, 2)}\n`);
}
console.log(`${PAGES} sentetik sayfa üretildi: ${outDir}`);

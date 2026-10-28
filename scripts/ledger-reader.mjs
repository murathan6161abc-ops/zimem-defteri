// ============================================================
// Veresiye defteri okuyucu — yerel Ollama görsel modeliyle
// ────────────────────────────────────────────────────────────
// Tarama bilgisayarı (scan-worker.mjs) ve ölçüm aracı (scan-bench.mjs) ortak kullanır.
//
// Hata oranını düşürmek için:
//  1. Model HESAP YAPMAZ; yalnızca satırları okur (ad, ürün, tutar, borç/ödeme/
//     toplam/kapanış, üstü çizili mi). Toplama, çıkarma, müşteri gruplama ve
//     "ödendi" kararı aşağıda kodla yapılır.
//  2. Model bağlamı 16K: sayfa fotoğrafı tek başına ~3.600 belirteç tutar;
//     Ollama'nın varsayılan 4K'sında uzun sayfaların cevabı yarıda kesiliyordu.
//  3. Tekrar cezaları kapalı (aynı rakamlar/ürünler defterde doğal olarak tekrarlanır).
//  4. Rakam güveni: modelin her rakam için verdiği olasılık okunur; emin olmadığı
//     tutar ya da çizgi kararı "kontrol et" diye işaretlenir.
//  5. Defterde yazan toplam, satırların toplamıyla karşılaştırılır; tutmazsa işaretlenir.
//  6. Üstü çizili / "ödendi" hesapları görmek modelin en zayıf yanı; bu yüzden ikinci,
//     kısa bir soruyla yalnızca kapanmış hesaplar sorulur. İki okuma çelişirse kayıt
//     "kontrol et" diye işaretlenir (ödenmiş borcun havuza sessizce girmemesi için).
// Güvenlik: müşteri adı bu bilgisayardan çıkmaz; yalnızca baş harfleri döner.
// ============================================================

import { cleanEntries, KIND_GROUP, LEDGER_KINDS, toInitials } from '../lib/ledgerParse.ts';

export const READER_VERSION = 2;
export const NUM_CTX = 16_384;
// Kalabalık bir sayfa (~60 satır) ~2.700 belirteç tutar; sınır, olası bir tekrar
// döngüsünün dakikalarca sürmesini de engeller.
const NUM_PREDICT = 4_096;
// Bu olasılığın altındaki rakam / çizgi kararları "kontrol et" diye işaretlenir.
export const AMOUNT_MIN_CONFIDENCE = 0.6;
export const CROSSED_MIN_CONFIDENCE = 0.75;
const MAX_LINES = 150;

export const LEDGER_LINES_PROMPT = `Bu fotoğraf, Türkiye'de bir esnafın el yazısıyla tuttuğu veresiye (borç) defterinden bir sayfa.
Görevin HESAP YAPMAK DEĞİL, sayfadaki satırları olduğu gibi okumak. Toplamayı ve çıkarmayı program yapacak.

Sayfayı yukarıdan aşağıya oku ve her satır için bir kayıt yaz:
- name: Satırın ait olduğu müşterinin adı, defterde yazdığı gibi ("Ahmet Yılmaz", "Fatma A."). Ad bir başlık olarak yazılıp altında satırlar varsa, alttaki her satıra o adı yaz. "Kalan", "Toplam" ve "ödendi" gibi satırlarda da name alanına o notun ait olduğu müşterinin adını yaz; name hiçbir satırda boş kalmasın.
- text: Satırdaki ürün/açıklama ("ekmek, süt") ya da ödeme/kapanış kelimesi ("ödedi", "ödendi"). Buraya kişi adı, lakap, adres ya da telefon YAZMA.
- amount: Satırdaki tutar, sayı olarak. "1.250" → 1250, "85 TL" → 85, "45,50" → 45.5, "-50" → 50. Tutar yoksa 0.
- kind:
  "debt" = müşterinin veresiye aldığı ürün/hizmet
  "payment" = müşterinin yaptığı ödeme ("ödedi 50", "-50", "50 verdi", "alındı 100", "Ödenen" sütunundaki tutar)
  "total" = sayfaya yazılmış toplam ya da kalan ("Kalan 130", "Toplam 450", "= 300")
  "closed" = hesabın kapandığını gösteren not: "ödendi", "tamam", "kapandı", "bitti" ya da ✓ işareti. Bu notlar tutar içermese bile MUTLAKA ayrı bir satır olarak yaz (amount 0).
- crossed: Satırın ya da müşterinin adının üzerinden geçen bir çizgi (düz ya da çapraz) varsa true. Çizgi bir müşterinin adından başlayıp satırlarının üzerinden geçiyorsa o müşterinin TÜM satırları crossed=true.
- date: Satırda tarih varsa YYYY-AA-GG (yıl yazmıyorsa bu yıl), yoksa "".
- category: gida (market, bakkal, fırın, manav, kasap, temizlik, sigara), egitim (kırtasiye, okul, kitap, fotokopi), fatura (elektrik, su, doğalgaz, telefon, internet), saglik (eczane, ilaç, bebek bezi, vitamin).

Tabloda aynı satırda hem "Borç" hem "Ödenen" sütunu doluysa İKİ kayıt yaz: biri debt, biri payment.
Sayfa başlığı ve sütun adları gibi müşteriye ait olmayan yazıları atla.
Fotoğraf bir veresiye/borç defteri değilse (menü, fiş, fatura, kitap, boş sayfa…) is_ledger=false ver ve lines boş olsun.
Sayfada olmayan satır UYDURMA; rakamları gördüğün gibi yaz.`;

/** Ollama "format" alanı için JSON Schema (yapılandırılmış çıktı). */
export const LEDGER_LINES_SCHEMA = {
  type: 'object',
  properties: {
    is_ledger: { type: 'boolean' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          text: { type: 'string' },
          amount: { type: 'number' },
          kind: { type: 'string', enum: ['debt', 'payment', 'total', 'closed'] },
          crossed: { type: 'boolean' },
          date: { type: 'string' },
          category: { type: 'string', enum: ['gida', 'egitim', 'fatura', 'saglik'] },
        },
        required: ['name', 'text', 'amount', 'kind', 'crossed', 'date', 'category'],
      },
    },
  },
  required: ['is_ledger', 'lines'],
};

export const NOT_LEDGER_WARNING = 'Bu fotoğraf bir veresiye defteri sayfasına benzemiyor.';

export const CLOSED_PROMPT = `Bu fotoğraf, el yazısıyla tutulmuş bir veresiye (borç) defteri sayfası.
Hangi müşterilerin hesabı KAPANMIŞ görünüyor? Kapanmış hesap: müşterinin adının ya da satırlarının üzerinden bir çizgi geçiyor (düz ya da çapraz, üstü çizili) VEYA yanında "ödendi", "tamam", "kapandı", "bitti" ya da ✓ işareti var.
Yalnızca bu müşterilerin adlarını defterde yazdığı gibi listele. Böyle bir müşteri yoksa boş liste ver.
Her kapanmış hesap için gördüğün işareti de yaz (sign): "cizgi" (üstü çizili), "yazi" (ödendi/tamam/kapandı yazısı) ya da "tik" (✓). Emin olmadığın adları "unsure" listesine yaz.`;

// "sign" (gördüğü işaret) ve "unsure" (emin olmadıkları) alanları modeli kanıta zorlar:
// bunlar olmadan kararsız kalınca herkesi "kapanmış" sayıyordu (29 yanlış alarm → 1).
export const CLOSED_SCHEMA = {
  type: 'object',
  properties: {
    closed: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, sign: { type: 'string', enum: ['cizgi', 'yazi', 'tik'] } },
        required: ['name', 'sign'],
      },
    },
    unsure: { type: 'array', items: { type: 'string' } },
  },
  required: ['closed', 'unsure'],
};

const MODEL_OPTIONS = { temperature: 0, top_k: 1, presence_penalty: 0, repeat_penalty: 1, num_ctx: NUM_CTX };

// ─── Model çağrısı ───────────────────────────────────────────
/**
 * Ollama'ya fotoğrafı gönderir; ham satırları ve her satırın rakam/çizgi güvenini döndürür.
 * Eski Ollama sürümleri "think" ya da "logprobs" parametresini tanımazsa onlarsız tekrar dener.
 */
export async function readLedgerLines(image, { url, model, timeoutMs = 170_000 }) {
  const started = Date.now();
  const optional = { think: false, logprobs: true };
  const request = (numPredict) =>
    fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: '1h',
        ...optional,
        format: LEDGER_LINES_SCHEMA,
        options: { ...MODEL_OPTIONS, num_predict: numPredict },
        messages: [{ role: 'user', content: LEDGER_LINES_PROMPT, images: [image] }],
      }),
      signal: AbortSignal.timeout(Math.max(10_000, timeoutMs - (Date.now() - started))),
    });

  let numPredict = NUM_PREDICT;
  let payload;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await request(numPredict);
    if (res.status === 400) {
      const text = await res.text();
      const unsupported = Object.keys(optional).find((key) => text.toLowerCase().includes(key.toLowerCase()));
      if (unsupported) {
        delete optional[unsupported];
        continue;
      }
      throw new Error(`ollama 400: ${text.slice(0, 120)}`);
    }
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    payload = await res.json();
    // Çok kalabalık sayfa: cevap sınıra dayandıysa bir kez daha geniş sınırla dene.
    if (payload?.done_reason === 'length' && numPredict === NUM_PREDICT && Date.now() - started < 60_000) {
      numPredict = NUM_CTX - (payload.prompt_eval_count ?? 4_000) - 64;
      continue;
    }
    break;
  }
  if (!payload) throw new Error('ollama: yanıt yok');
  if (payload.done_reason === 'length') throw new Error('sayfa çok kalabalık (çıktı sınırı)');

  const content = String(payload?.message?.content ?? '');
  const parsed = JSON.parse(content);
  const amountConf = valueConfidence(content, payload.logprobs, 'amount');
  const crossedConf = valueConfidence(content, payload.logprobs, 'crossed');
  const lines = (Array.isArray(parsed?.lines) ? parsed.lines : []).slice(0, MAX_LINES).map((l, i) => ({
    ...(l && typeof l === 'object' ? l : {}),
    amountConfidence: amountConf[i] ?? 1,
    crossedConfidence: crossedConf[i] ?? 1,
  }));
  return {
    isLedger: parsed?.is_ledger !== false,
    lines,
    stats: { seconds: (Date.now() - started) / 1000, outputTokens: payload.eval_count ?? 0 },
  };
}

/** İkinci, kısa soru: kapanmış (üstü çizili / "ödendi") hesapların adları. Başarısızsa null. */
export async function readClosedNames(image, { url, model, timeoutMs = 60_000 }) {
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: '1h',
        think: false,
        format: CLOSED_SCHEMA,
        options: { ...MODEL_OPTIONS, num_predict: 512 },
        messages: [{ role: 'user', content: CLOSED_PROMPT, images: [image] }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    if (payload?.done_reason === 'length') return null;
    const parsed = JSON.parse(String(payload?.message?.content ?? ''));
    if (!Array.isArray(parsed?.closed)) return null;
    return parsed.closed
      .map((c) => (c && typeof c === 'object' ? String(c.name ?? '') : String(c)))
      .filter(Boolean)
      .slice(0, 60);
  } catch {
    return null;
  }
}

/** Çıktıdaki her `"amount": …` / `"crossed": …` değeri için modelin en düşük belirteç olasılığı (0–1). */
export function valueConfidence(content, logprobs, key) {
  if (!Array.isArray(logprobs) || logprobs.length === 0) return [];
  const spans = [];
  let pos = 0;
  for (const t of logprobs) {
    const len = Array.isArray(t?.bytes) ? t.bytes.length : Buffer.byteLength(String(t?.token ?? ''));
    spans.push([pos, pos + len, Math.exp(Number(t?.logprob) || 0)]);
    pos += len;
  }
  const re = key === 'amount' ? /"amount"\s*:\s*(-?[\d.]+)/g : /"crossed"\s*:\s*(true|false)/g;
  const out = [];
  for (const m of content.matchAll(re)) {
    const start = Buffer.byteLength(content.slice(0, m.index + m[0].length - m[1].length));
    const end = start + Buffer.byteLength(m[1]);
    let min = 1;
    for (const [s, e, p] of spans) if (s < end && e > start) min = Math.min(min, p);
    out.push(min);
  }
  return out;
}

// ─── Satırlardan müşteri borçlarına (kodla, hatasız hesap) ────
const normName = (s) =>
  String(s ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function toNumber(v) {
  const n =
    typeof v === 'number'
      ? v
      : Number(
          String(v ?? '')
            .replace(/[^\d.,]/g, '')
            .replace(/\.(?=\d{3}(\D|$))/g, '')
            .replace(',', '.'),
        );
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

// ─── Ürün adından borç türü ──────────────────────────────────
// Modele 10 tür sorulunca satırları türlere bölüp tekrar döngüsüne giriyordu; bu yüzden
// model yalnızca 4 grubu söyler, ayrıntılı türü ürün adlarından bu liste belirler.
// Sıra önemli: "su faturası" gıdadaki "su"dan, "iç çamaşırı" temizlikteki "çamaşır"dan,
// "okul servisi" eğitimdeki "okul"dan önce yakalanır.
const KIND_KEYWORDS = [
  ['fatura', /(elektrik|doğal ?gaz|dogal ?gaz|su faturas|fatura|telefon|internet|kontör|kontor|aidat|abonelik)/u],
  ['giyim', /(iç çamaşır|mont|ayakkabı|ayakkabi|çorap|corap|pantolon|elbise|tişört|tisort|gömlek|gomlek|kazak|etek|ceket|terlik|eşofman|esofman|atkı|bere|eldiven|kaban|bot$)/u],
  ['bebek', /(bebek|mama|^bez(i|ler|leri)?$|biberon|emzik|ıslak mendil|pudra)/u],
  ['temizlik', /(deterjan|sabun|şampuan|sampuan|çamaşır|camasir|bulaşık|bulasik|yumuşatıcı|yumusatici|tuvalet|peçete|pecete|havlu|sünger|sunger|çöp|diş macun|diş fırça|klor|temizlik)/u],
  ['saglik', /(ilaç|ilac|eczane|vitamin|şurup|surup|tansiyon|ağrı kesici|agri kesici|antibiyotik|krem($| |i)|merhem|reçete|recete|maske|termometre|serum|iğne)/u],
  ['ulasim', /(servis|akbil|istanbulkart|kentkart|benzin|bilet|otobüs|otobus|dolmuş|dolmus|taksi|yol parası)/u],
  ['egitim', /(defter|kalem|silgi|kitap|fotokopi|boya|cetvel|kırtasiye|kirtasiye|dosya|okul|test kitab|çanta|canta|pergel)/u],
  ['yakacak', /(tüp|tup|kömür|komur|odun|mazot|gazyağ|pelet|soba|ısınma)/u],
  // En son: yiyecek-içecek (kısa kelimeler tam eşleşir: "un", "et", "su"…)
  [
    'gida',
    /((^| )(un|et|su|yağ|yag|çay|cay|şeker|seker|tuz|bal|kek|muz)($| )|ekme|süt|sut|yumurta|peynir|zeytin|makarna|pirinç|pirinc|domates|patates|soğan|sogan|kıyma|kiyma|tavuk|bulgur|mercimek|salça|salca|kola|meyve|sebze|bisküvi|biskuvi|sigara|sucuk|salam|yoğurt|yogurt|ayran|cips|çikolata|cikolata|fındık|findik|reçel|recel|nohut|fasulye|limon|elma|portakal|balık|balik|kahve|gofret|simit|poğaça|pogaca|börek|borek|margarin|konserve|dondurma)/u,
  ],
];

/** "sabun, kıyma, bulgur" → her ürün için tür oyları (eşleşmeyen ürün oy vermez). */
function kindVotes(text) {
  const votes = [];
  for (const item of String(text ?? '').toLocaleLowerCase('tr-TR').split(/[,;/+]| ve /)) {
    const word = item.replace(/\d[\d.,\s]*(tl|₺|lira)?/giu, ' ').replace(/\s+/g, ' ').trim();
    if (!word) continue;
    const hit = KIND_KEYWORDS.find(([, re]) => re.test(word));
    if (hit) votes.push(hit[0]);
  }
  return votes;
}

// Kapanış notu yalnızca gerçekten böyle bir ifade içeriyorsa sayılır (model boş not uydurabiliyor).
const CLOSING_WORDS = /(ödendi|odendi|ödenmiş|odenmis|tamam|kapand|kapatıldı|bitti|hesap kapa|✓|✔|☑)/iu;

// Ad sütununa yanlışlıkla yazılan etiketler: "Toplam 965" satırı müşteri değildir.
const LABEL_WORDS = /^(genel |ara )?(toplam|top|kalan|yekün|yekun|borç|borc|ödendi|odendi|tamam|kapandı|kapandi)$/;

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function validDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return '';
  const year = Number(m[1]);
  const now = new Date().getFullYear();
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (year < now - 5 || year > now + 1 || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== m[0]) return '';
  return m[0];
}

/** Açıklamadan rakamları (telefon vb.), para birimini ve müşterinin kendi adını ayıklar. */
function cleanItemText(text, nameWords) {
  return String(text ?? '')
    .replace(/\d[\d.\s]*(?:,\d+)?\s*(tl|₺|lira)?/giu, ' ')
    .split(/\s+/)
    .filter((w) => w && !nameWords.has(normName(w)))
    .join(' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim();
}

/**
 * Satırları müşteri bazında toplar. Dönen kayıtlar cleanEntries'ten geçer
 * (baş harf, beyaz liste, aralık kontrolü).
 */
export function aggregateLines(lines, { isLedger = true, closedNames = null } = {}) {
  if (!isLedger) return { entries: [], warning: NOT_LEDGER_WARNING, warningCode: 'not_ledger' };
  const valid = lines.filter(
    (l) =>
      l &&
      typeof l === 'object' &&
      ['debt', 'payment', 'total', 'closed'].includes(l.kind) &&
      (l.kind !== 'closed' || CLOSING_WORDS.test(String(l.text ?? ''))),
  );

  // "Fatma A." kısaltmasını sayfadaki tek eşleşen tam ada ("Fatma Aydın") bağla.
  const fullNames = [
    ...new Set(
      valid.map((l) => normName(l.name)).filter((n) => n.split(' ').length >= 2 && n.split(' ').at(-1).length > 1),
    ),
  ];
  const keyOf = (name) => {
    const n = normName(name);
    const parts = n.split(' ');
    if (parts.length >= 2 && parts.at(-1).length === 1) {
      const match = fullNames.filter((f) => {
        const fp = f.split(' ');
        return fp[0] === parts[0] && fp.at(-1)[0] === parts.at(-1);
      });
      if (match.length === 1) return match[0];
    }
    return n;
  };

  const groups = new Map();
  let lastKey = '';
  const suspicious = new Set(); // sahibi belirsiz kapanış notu komşusu: kontrol gerekir
  for (const l of valid) {
    // Adı boş ya da ad yerine "Toplam/Kalan" yazılmış satır (bloğun altındaki toplam)
    // bir önceki müşteriye aittir.
    const name = LABEL_WORDS.test(normName(l.name)) ? '' : l.name;
    let key = normName(name) ? keyOf(name) : '';
    // Adsız "ödendi" notu kime ait belli değil: kimseyi ödenmiş sayma, yalnızca uyar.
    if (!key && l.kind === 'closed') {
      if (lastKey) suspicious.add(lastKey);
      continue;
    }
    key ||= lastKey || '?';
    lastKey = key;
    if (!groups.has(key)) groups.set(key, { name: String(name ?? ''), lines: [] });
    groups.get(key).lines.push(l);
  }
  // Borç satırı olmayan grup (ör. adı farklı okunmuş "ödendi" notu) en yakın adlı müşteriye
  // katılır; benzer ad yoksa atılır (yanlış müşteriyi "ödendi" saymamak için).
  for (const [key, g] of [...groups]) {
    if (g.lines.some((l) => l.kind === 'debt') || key === '?') continue;
    let best = null;
    for (const [other, og] of groups) {
      if (other === key || !og.lines.some((l) => l.kind === 'debt')) continue;
      const dist = editDistance(key, other);
      if (dist <= 2 && (!best || dist < best.dist)) best = { other, dist };
    }
    if (best) groups.get(best.other).lines.push(...g.lines);
    groups.delete(key);
  }

  const raw = [];
  for (const [key, g] of groups) {
    const amountOf = (l) => toNumber(l.amount);
    const debts = g.lines.filter((l) => l.kind === 'debt' && amountOf(l) > 0);
    // Ürün yazıp tutarı okunamayan borç satırı: toplam eksik kalır, kontrol gerekir.
    const missingAmount = g.lines.some((l) => l.kind === 'debt' && l.crossed !== true && !(amountOf(l) > 0));
    const liveDebts = debts.filter((l) => l.crossed !== true);
    const payments = g.lines.filter((l) => l.kind === 'payment' && amountOf(l) > 0);
    const livePayments = payments.filter((l) => l.crossed !== true);
    const totals = g.lines.filter((l) => l.kind === 'total' && l.crossed !== true && amountOf(l) > 0);
    const closedNote = g.lines.some((l) => l.kind === 'closed');
    if (debts.length === 0 && totals.length === 0) continue;

    const sum = (list) => list.reduce((s, l) => s + amountOf(l), 0);
    const computed = Math.round(sum(liveDebts) - sum(livePayments));
    const written = totals.length ? Math.round(amountOf(totals.at(-1))) : null;
    const allCrossed = debts.length > 0 && liveDebts.length === 0;
    const paid = allCrossed || closedNote || (debts.length > 0 && written === null && computed <= 0);

    let amount = written ?? computed;
    let issue = null;
    if (!paid && written !== null && liveDebts.length > 0 && written !== computed) issue = 'mismatch';
    if (paid) amount = Math.round(sum(debts) - sum(payments)) || written || Math.round(sum(debts));
    const relevant = paid ? g.lines : g.lines.filter((l) => l.kind !== 'closed');
    const unclear = relevant.some(
      (l) =>
        (l.amountConfidence ?? 1) < AMOUNT_MIN_CONFIDENCE ||
        (l.crossedConfidence ?? 1) < CROSSED_MIN_CONFIDENCE,
    );
    if (!issue && (unclear || suspicious.has(key) || (!paid && missingAmount && written === null))) issue = 'unclear';
    // İkinci soruyla karşılaştır: kapanmış görünüyor ama borç sayıldıysa en önemli uyarı bu.
    if (Array.isArray(closedNames)) {
      const initials = toInitials(g.name);
      const closedSays = closedNames.some((n) => {
        const k = normName(n);
        return k && (keyOf(n) === key || (initials && toInitials(n) === initials));
      });
      if (!paid && closedSays) issue = 'maybe_paid';
      else if (paid && !closedSays && !issue) issue = 'unclear';
    }

    const nameWords = new Set(normName(g.name).split(' ').filter((w) => w.length > 1));
    // Satırlardaki ürünleri tek listede, tekrarsız topla ("deterjan" iki satırda geçse de bir kez).
    const items = [
      ...new Set(
        debts
          .flatMap((l) => cleanItemText(l.text, nameWords).split(/\s*[,;/]\s*/))
          .map((w) => w.trim())
          .filter(Boolean),
      ),
    ].join(', ');
    // Tür: ürün adlarından en çok oy alan; hiç eşleşme yoksa modelin söylediği grup.
    const votes = {};
    for (const l of debts) for (const k of kindVotes(l.text)) votes[k] = (votes[k] ?? 0) + 1;
    let kind = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!kind) {
      const groupVotes = {};
      for (const l of debts) if (LEDGER_KINDS.includes(l.category)) groupVotes[l.category] = (groupVotes[l.category] ?? 0) + 1;
      kind = Object.entries(groupVotes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'gida';
    }
    const category = KIND_GROUP[kind];
    const dates = g.lines.map((l) => validDate(l.date)).filter(Boolean).sort();

    raw.push({
      ref: key === '?' ? '' : g.name,
      items,
      amount,
      date: dates.at(-1) ?? '',
      category,
      kind,
      paid,
      confidence: issue ? 'low' : 'high',
      issue,
      breakdown: {
        debts: liveDebts.map(amountOf),
        payments: livePayments.map(amountOf),
        written,
      },
    });
  }
  // cleanEntries: baş harfe çevirir (tam ad bu bilgisayardan çıkmaz) ve her alanı denetler.
  return { entries: cleanEntries({ entries: raw }), warning: '', warningCode: '' };
}

/** Tek çağrıda: fotoğraf → temizlenmiş borç kayıtları (satır okuma + kapanmış hesap kontrolü). */
export async function readLedger(image, opts) {
  const started = Date.now();
  const { isLedger, lines, stats } = await readLedgerLines(image, opts);
  const hasDebts = isLedger && lines.some((l) => l?.kind === 'debt');
  const remaining = (opts.timeoutMs ?? 170_000) - (Date.now() - started);
  const closedNames = hasDebts && remaining > 20_000 ? await readClosedNames(image, { ...opts, timeoutMs: Math.min(60_000, remaining - 5_000) }) : null;
  return {
    ...aggregateLines(lines, { isLedger, closedNames }),
    stats: { ...stats, lines: lines.length, closedCheck: closedNames !== null, seconds: (Date.now() - started) / 1000 },
  };
}


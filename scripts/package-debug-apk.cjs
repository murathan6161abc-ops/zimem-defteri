const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const outputDirectory = path.join(root, 'dist');
const outputName = `D-Zimem-v${pkg.version}-debug.apk`;
const destination = path.join(outputDirectory, outputName);

if (!fs.existsSync(source)) {
  throw new Error(`APK bulunamadı: ${source}`);
}

fs.mkdirSync(outputDirectory, { recursive: true });
fs.copyFileSync(source, destination);

const checksum = crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
fs.writeFileSync(
  path.join(outputDirectory, 'SHA256SUMS.txt'),
  `${checksum}  ${outputName}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(outputDirectory, 'release-manifest.json'),
  `${JSON.stringify(
    {
      app: 'Dijital Zimem Defteri',
      version: pkg.version,
      artifact: outputName,
      sha256: checksum,
      buildType: 'debug',
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Teslim paketi hazır: dist/${outputName}`);

// Kolay erişim: en güncel APK'yı Masaüstü/D-Zimem klasörüne de koy (yalnızca son
// sürüm kalır; asıl kopyalar dist/ içinde durur). CI'da DZIMEM_NO_DESKTOP_COPY=1.
const desktop = path.join(require('node:os').homedir(), 'Desktop');
if (!process.env.DZIMEM_NO_DESKTOP_COPY && fs.existsSync(desktop)) {
  const easyDir = path.join(desktop, 'D-Zimem');
  fs.mkdirSync(easyDir, { recursive: true });
  for (const old of fs.readdirSync(easyDir)) {
    if (/^D-Zimem-v[\d.]+\.apk$/.test(old)) fs.rmSync(path.join(easyDir, old));
  }
  const easyName = `D-Zimem-v${pkg.version}.apk`;
  fs.copyFileSync(destination, path.join(easyDir, easyName));
  console.log(`Kolay erişim kopyası: Masaüstü/D-Zimem/${easyName}`);
}

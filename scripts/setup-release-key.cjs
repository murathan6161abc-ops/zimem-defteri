// Release APK imza anahtarını bir kez üretir. Anahtar proje klasörünün DIŞINDA,
// ~/.dzimem-imza/ içinde durur (DZIMEM_KEYSTORE_DIR ile değiştirilebilir);
// android/keystore.properties yalnızca yolunu ve şifresini tutar (git'e girmez). Varsa dokunmaz.
//
// ÖNEMLİ: Bu iki dosyanın yedeğini güvenli bir yere al. Anahtar kaybolursa telefonlardaki
// uygulama güncellenemez; katılımcıların eski sürümü silip yenisini kurması gerekir.
const crypto = require('node:crypto');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const androidDirectory = path.join(root, 'android');
const propertiesFile = path.join(androidDirectory, 'keystore.properties');
const keystoreDirectory = process.env.DZIMEM_KEYSTORE_DIR || path.join(os.homedir(), '.dzimem-imza');
const keystoreName = 'dzimem-release.keystore';
const keystoreFile = path.join(keystoreDirectory, keystoreName);

const backupProperties = path.join(keystoreDirectory, 'keystore.properties');

if (fs.existsSync(propertiesFile)) {
  console.log('Release imza anahtarı zaten var (android/keystore.properties).');
  process.exit(0);
}
// Başka bir klasörde (ör. yeni bir klon) daha önce üretilmiş anahtar varsa onu kullan.
if (fs.existsSync(backupProperties) && fs.existsSync(keystoreFile)) {
  fs.copyFileSync(backupProperties, propertiesFile);
  fs.chmodSync(propertiesFile, 0o600);
  console.log(`Mevcut imza anahtarı kullanılıyor: ${keystoreFile}`);
  process.exit(0);
}
if (fs.existsSync(keystoreFile)) {
  throw new Error(`${keystoreFile} var ama keystore.properties yok. Şifreyi bilmeden yeni anahtar üretilmez.`);
}
fs.mkdirSync(keystoreDirectory, { recursive: true, mode: 0o700 });

function findKeytool() {
  const homes = [process.env.JAVA_HOME, '/Applications/Android Studio.app/Contents/jbr/Contents/Home'];
  if (process.platform === 'darwin' && fs.existsSync('/usr/libexec/java_home')) {
    const result = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' });
    if (result.status === 0) homes.push(result.stdout.trim());
  }
  for (const home of homes.filter(Boolean)) {
    const candidate = path.join(home, 'bin', 'keytool');
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'keytool';
}

// PKCS12 anahtar deposunda depo ve anahtar şifresi aynı olmalı.
const password = crypto.randomBytes(24).toString('base64url');
const alias = 'dzimem';
const result = spawnSync(
  findKeytool(),
  [
    '-genkeypair',
    '-keystore', keystoreFile,
    '-storetype', 'PKCS12',
    '-alias', alias,
    '-keyalg', 'RSA',
    '-keysize', '4096',
    '-validity', '10000',
    '-storepass', password,
    '-keypass', password,
    '-dname', 'CN=Dijital Zimem Defteri, O=D-Zimem, C=TR',
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
if (result.status !== 0) throw new Error('keytool ile imza anahtarı üretilemedi.');

fs.writeFileSync(
  propertiesFile,
  [
    '# D-Zimem release imzası — GİZLİ, git\'e ekleme, yedeğini al.',
    `storeFile=${keystoreFile}`,
    `storePassword=${password}`,
    `keyAlias=${alias}`,
    `keyPassword=${password}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
);
fs.copyFileSync(propertiesFile, backupProperties);
fs.chmodSync(backupProperties, 0o600);
fs.chmodSync(keystoreFile, 0o600);
console.log(`Release imza anahtarı üretildi: ${keystoreFile} (+ android/keystore.properties)`);
console.log('Bu iki dosyanın yedeğini güvenli bir yere al (ör. şifreli bir USB bellek).');

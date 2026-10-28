# Teslim ve sürüm rehberi

## Ön kontrol

```bash
npm ci
npm run check
npm audit --omit=dev
```

Supabase tarafında bekleyen göç ve danışman uyarılarını kontrol et:

```bash
npx supabase migration list
npx supabase db lint
```

## Debug APK

Jüri, öğretmen ve cihaz testi için:

```bash
npm run delivery:debug
```

`dist/` içinde sürümlü APK, SHA-256 ve JSON manifest oluşur. Teslim alan kişi
checksum ile dosyanın bozulmadığını doğrulayabilir.

```bash
cd dist
shasum -a 256 -c SHA256SUMS.txt
```

## Release APK (katılımcılara dağıtım)

Katılımcı telefonlarına **debug APK verilmez**: debug sürümde hata ayıklama açıktır ve
telefona USB ile erişen biri uygulamanın oturum bilgilerini okuyabilir.

```bash
npm run delivery:release
```

İlk çalıştırmada imza anahtarı üretilir: `~/.dzimem-imza/dzimem-release.keystore` ve
`android/keystore.properties` (ikisi de git dışında). **Bu iki dosyanın yedeğini al**;
anahtar kaybolursa telefonlardaki uygulama güncellenemez. Debug sürümden release sürüme
geçen bir telefonda imza değiştiği için eski uygulama önce silinmelidir (veriler sunucuda
olduğundan kaybolmaz).

## Üretim AAB

1. Android Studio'da `android/` projesini aç.
2. `Build > Generate Signed App Bundle or APK` ile Android App Bundle seç.
3. Keystore'u proje klasörü ve Git dışında sakla.
4. `release` varyantını üret.
5. AAB'yi gerçek cihazdaki release build ile doğrula.

Debug APK mağazaya veya gerçek kullanıcı dağıtımına verilmez. Keystore,
`key.properties`, `.jks` ve signing parolaları depoya eklenmez.

## Sürüm artırma

Aynı sürümü şu üç yerde güncelle:

- `package.json` içindeki `version`
- `lib/version.ts` içindeki `APP_VERSION`
- `android/app/build.gradle` içindeki `versionName` ve artan `versionCode`

Ardından `npm run check`, Supabase danışmanları ve `npm run delivery:debug`
yeniden çalıştırılır.

## Teslim içeriği

- Kaynak depo ve `package-lock.json`
- `supabase/migrations/`
- İmzalı AAB veya amaç açıkça belirtilmiş debug APK
- `SHA256SUMS.txt` ve `release-manifest.json`
- Proje/araştırma belgeleri
- Gizli anahtar içermeyen `.env.example`

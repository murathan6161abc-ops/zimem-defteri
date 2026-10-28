# D-Zimem kurulum rehberi

## Gereksinimler

- Node.js 22 veya daha yeni bir sürüm
- npm 10 veya daha yeni bir sürüm
- Supabase hesabı
- Android teslimi için Android SDK ve Java 21
- Yerel Supabase doğrulaması için Docker

## 1. Bağımlılıklar

```bash
npm install
```

Paket sürümleri sabitlenmiştir; `package-lock.json` teslimin parçasıdır.

## 2. Supabase şeması

Yeni bir Supabase projesi oluşturduktan sonra:

```bash
npx supabase login
npx supabase link --project-ref PROJE_REF
npx supabase db push
```

Şemanın tek kaynağı `supabase/migrations/` dizinidir. Eski bağımsız SQL
dosyalarını ayrıca çalıştırma.

Supabase Dashboard'da Authentication ayarlarını kontrol et:

- Email confirmation: kapalı (uygulama sentetik kullanıcı e-postası kullanıyor)
- Minimum password length: 10
- Leaked password protection: açık
- Public yayından önce CAPTCHA: açık

## 3. Ortam değişkenleri

```bash
cp .env.example .env.local
```

`.env.local` içine proje URL'sini ve etkin publishable key'i yaz:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJE_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Eski projelerde legacy anon key, geçiş süresince
`NEXT_PUBLIC_SUPABASE_ANON_KEY` adıyla desteklenir. Secret/service-role key hiçbir
zaman `NEXT_PUBLIC_` değişkenine yazılmaz.

## 4. Yönetici hesabı

1. Uygulamadan veya Dashboard'dan `admin` kullanıcısını oluştur.
2. `supabase/assign_admin.sql.example` içindeki hedef e-postayı kontrol et.
3. Dosyayı Supabase SQL Editor'de çalıştır.
4. Yönetici hesabından çıkış yapıp yeniden giriş yap.

Yönetici yetkisi tarayıcıya gömülen bir şifreyle değil, Supabase tarafından
yönetilen `app_metadata.role=admin` değeriyle doğrulanır.

## 5. Çalıştırma ve kontrol

```bash
npm run dev
npm run check
```

- Uygulama: `http://localhost:3939`
- Yönetim: `http://localhost:3939/admin/`

## 6. Android debug teslimi

```bash
npm run delivery:debug
```

Çıktılar:

- `dist/D-Zimem-v<sürüm>-debug.apk`
- `dist/SHA256SUMS.txt`
- `dist/release-manifest.json`

Debug APK yalnızca test ve jüri sunumu içindir. Mağaza/üretim teslimi için
[docs/RELEASE.md](./docs/RELEASE.md) içindeki imzalı AAB akışını kullan.

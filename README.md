# D-Zimem

Kadim zimem defteri geleneğini dijital bir iyilik ve araştırma deneyimine
dönüştüren Next.js + Capacitor uygulaması. Bu depo web uygulaması, Android
kaynağı, Supabase göçleri ve teslim belgeleri için tek kaynak kabul edilir.

## Uygulama

- Vatandaş: anonim borç havuzu, ön test, tam/kısmi ödeme, son test, XP ve geçmiş
- Esnaf: borç ekleme ve kendi defterini izleme
- Araştırma: PANAS-SF, WHO-5 ve ön/son test ölçümleri
- Yönetim: yalnızca Supabase `app_metadata.role=admin` yetkisiyle veri okuma,
  CSV/JSON dışa aktarma ve cihaz dışına veri göndermeyen yerel araştırma özeti
- Teslim: statik Next.js export, Capacitor Android ve checksum'lı APK paketi

## Hızlı başlangıç

```bash
npm install
cp .env.example .env.local
npm run dev
```

Uygulama `http://localhost:3939` adresinde açılır. Supabase kurulumu ve yönetici
ataması için [SETUP.md](./SETUP.md), güvenlik modeli için
[SECURITY.md](./docs/SECURITY.md), APK teslimi için
[RELEASE.md](./docs/RELEASE.md) kullanılır.

## Komutlar

| Komut | Amaç |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (`3939`) |
| `npm run lint` | ESLint kontrolü |
| `npm run typecheck` | TypeScript kontrolü |
| `npm run build` | Statik web çıktısı (`out/`) |
| `npm run check` | Lint + tip + üretim build'i |
| `npm run android:sync` | Web build'i ve Capacitor senkronizasyonu |
| `npm run android:debug` | Debug APK üretimi |
| `npm run delivery:debug` | APK + SHA-256 + teslim manifesti (`dist/`) |

## Kaynak düzeni

| Yol | Sorumluluk |
| --- | --- |
| `app/` | Next.js sayfaları |
| `components/` | Arayüz ve akış bileşenleri |
| `lib/` | Auth, Supabase, analiz ve iş kuralları |
| `store/` | Zustand uygulama durumu |
| `supabase/migrations/` | Tek ve sıralı veritabanı şema kaynağı |
| `android/` | Capacitor Android projesi |
| `docs/` | Güvenlik ve teslim belgeleri |
| `scripts/` | Varlık ve teslim yardımcıları |

## Sürüm

Geçerli uygulama sürümü `2.1.1`'dir. Sürüm artırırken `package.json`,
`lib/version.ts` ve `android/app/build.gradle` birlikte güncellenir.

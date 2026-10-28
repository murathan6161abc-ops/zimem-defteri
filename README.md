# D-Zimem

Zimem defteri geleneğinde varlıklı biri bakkalın veresiye defterine gidip
tanımadığı birinin borcunu öder; kimin ödediği de kimin borcu olduğu da
bilinmez. D-Zimem bunu bir uygulamaya taşır ve bir TÜBİTAK 2204 projesi
kapsamında borç kapatmanın kişinin duygu durumuna etkisini ölçer.

Uygulama Next.js ile yazılmıştır, Android'e Capacitor ile paketlenir, veriler
Supabase'te durur.

## Kim ne yapar

- Vatandaş: açık borçları görür, bir borcu tamamen ya da kısmen kapatır.
  Ödemeden önce üç, sonra dört kısa soru cevaplar; puan, seviye ve geçmiş tutulur.
- Esnaf: borç ekler (elle ya da veresiye defterinin fotoğrafından), kendi
  defterini izler, borç kapanınca bildirim alır.
- Araştırma: ön/son test soruları, isteğe bağlı PANAS maddeleri ve haftalık WHO-5.
- Yönetim: Supabase `app_metadata.role=admin` yetkisiyle anket verisini okuma,
  CSV/JSON dışa aktarma ve betimsel araştırma özeti.

## Ödeme akışı

1. "Borcu kapat" ya da "Bir kısmını öde" → ön test.
2. Onay penceresi → `pay_merchant_debt` sunucuda bakiyeyi atomik olarak düşer.
   Borç bu arada kapanmışsa kullanıcıya söylenir, puan verilmez; bağlantı
   yoksa adımda kalınır ve tekrar denenir.
3. Son test → puan, geçmiş ve anket kaydı yazılır.

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
| `npm test` | Vitest birim testleri (Türkiye saatiyle koşar) |
| `npm run build` | Statik web çıktısı (`out/`) |
| `npm run check` | Lint + tip + test + üretim build'i |
| `npm run android:sync` | Web build'i ve Capacitor senkronizasyonu |
| `npm run android:debug` | Debug APK üretimi |
| `npm run delivery:debug` | Debug APK + SHA-256 + teslim manifesti (`dist/`) |
| `npm run delivery:release` | Katılımcılara dağıtılacak imzalı release APK (`dist/`) |

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

Geçerli uygulama sürümü `2.6.0`'dır. Sürüm artırırken `package.json`,
`lib/version.ts` ve `android/app/build.gradle` birlikte güncellenir.

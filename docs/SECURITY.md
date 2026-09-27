# Güvenlik modeli

## Sınır

D-Zimem statik olarak dışa aktarılır ve APK içinde çalışır. Bu nedenle frontend
paketindeki her değer kullanıcı tarafından okunabilir kabul edilir. Publishable
key gizli değildir; veri güvenliği Supabase Auth, en az yetki ve RLS ile sağlanır.

Secret/service-role key, veritabanı parolası veya üçüncü taraf AI anahtarı
istemciye konmaz. Araştırma özeti cihazda hesaplanır ve ham veri dış servise
gönderilmez.

## Yetki matrisi

| Kaynak | Katılımcı | Yönetici |
| --- | --- | --- |
| `survey_submissions` | Kendi satırını ekler/okur | Tümünü okur |
| `who5_measurements` | Kendi satırını ekler/okur | Tümünü okur |
| `device_snapshots` | Kendi satırını ekler/okur/günceller | Tümünü okur |
| `merchant_debts` | Okur, kendi borcunu ekler, kendi açık borcunu siler | Okur |
| `scan_jobs` | Esnaf kendi işini ekler/okur (günde 30), bekleyenini iptal eder; silemez, sonuç yazamaz | — |
| `scan_jobs` (tarama bilgisayarı) | `app_metadata.role=scan_worker`: işleri okur, sonucu yazar, eskileri siler | — |
| Borç bakiyesi | Yalnızca atomik `pay_merchant_debt` RPC | Aynı |
| Liderlik | UUID içermeyen `get_leaderboard` RPC | Aynı |

Yönetici kararı yalnızca kullanıcı tarafından değiştirilemeyen
`auth.users.raw_app_meta_data` içindeki `role=admin` değeriyle verilir.
`user_metadata` hiçbir yetkilendirme kararında kullanılmaz.

## İki adımlı doğrulama (TOTP)

2FA açık hesapta şifre (veya e-posta sıfırlama kodu) yalnızca `aal1` oturum verir.
Tüm tablolarda `mfa_required` adlı **restrictive** RLS politikası ve
`pay_merchant_debt` içindeki kontrol, doğrulanmış faktörü olan kullanıcıdan `aal2`
ister. Yani şifre sıfırlamak 2FA'yı atlatmaz; kontrol istemcide değil veritabanındadır.
Faktörünü kaybeden kullanıcı için yönetici SQL Editor'de:
`delete from auth.mfa_factors where user_id = '<uuid>';`

## Kayıt, kurtarma e-postası ve Google girişi

- **Yeni kayıt** e-posta + 6 haneli kodla yapılır (`signInWithOtp`): e-posta sahipliği hesap
  kullanılabilir hâle gelmeden kanıtlanır. Kod doğrulanana ve şifre belirlenene kadar hesap
  `signupCompleted: false` durumundadır ve uygulamaya alınmaz. Yarım kalmış kaydı e-postanın
  gerçek sahibi kodla devralabilir; tamamlanmış bir hesaba bu yoldan girilemez.
- **Eski kullanıcı-adı hesapları** (`kullanici@dzimem.app`) Profil'den kurtarma e-postası
  ekleyebilir; değişiklik yeni adrese giden kodla onaylanana kadar uygulanmaz. `auth.users`
  tetikleyicileri eski kullanıcı adını sahibine ayırır.
- **Google ile giriş** Supabase OAuth + PKCE ile yapılır; APK'da sistem tarayıcısı ve
  `com.dzimem.app://login-callback` kullanılır. Dönüş bağlantısını başka bir uygulama yakalasa
  bile cihazdaki `code_verifier` olmadan oturum açamaz. İlk girişte rol, takma ad ve araştırma
  onamı zorunludur (`/profil-tamamla`). Google'ın ilettiği ad/fotoğraf `auth.users` içinde
  saklanır ama uygulamada gösterilmez ve araştırma tablolarına yazılmaz.

## Defter tarama

Fotoğraf `scan_jobs` kuyruğuna yazılır ve yöneticinin bilgisayarındaki tarama
programı (`scripts/scan-worker.mjs`) tarafından yerel Ollama modeliyle okunur;
hiçbir yapay zekâ şirketine gönderilmez. Program sonucu yazarken fotoğrafı siler,
3 günden eski işleri temizler; log'a fotoğraf ya da okunan içerik yazmaz.
Sonucu yalnızca `scan_worker` rolü yazabilir; esnaf kendi işini "tamamlandı"
yapamaz ve kotayı sıfırlamak için işini silemez. Model çıktısı hem programda hem
uygulamada aynı beyaz listeden geçer (`lib/ledgerParse.ts`); müşteri adı ne
gelirse gelsin baş harfe indirgenir ve yalnızca esnafın cihazında tutulur.
Tarama hesabının şifresi yalnızca o bilgisayardaki `.env.tarama` dosyasındadır
(izin 600, git dışı); sızarsa hesabın şifresi değiştirilmeli ya da rolü kaldırılmalıdır.

## İstemci ve Android

- Üretim CSP'si bağlantıları aynı kaynağa ve yapılandırılmış Supabase projesine sınırlar.
- Capacitor mixed content, cleartext trafik, WebView debug logları ve Android backup kapalıdır.
- CSV dışa aktarımında formül enjeksiyonu etkisizleştirilir.
- Bağımlılıklar tam sürüme sabitlenir ve lockfile teslim edilir.

## Bilinen sınırlar

- XP hesabı istemcide yapılır. RLS başka hesaba yazmayı engeller ancak kötü niyetli
  bir kullanıcı kendi skorunu taklit edebilir. Ödül veya maddi sonuç eklenirse XP
  hesabı bir sunucu fonksiyonuna taşınmalıdır.
- Parola kurtarma yalnızca kurtarma e-postası eklemiş hesaplarda mümkündür.
- E-posta ile kod gönderimi (kayıt, sıfırlama) herkese açıktır; bir adrese istenmeyen kod
  e-postası tetiklenebilir. Supabase e-posta hız sınırı bunu yavaşlatır; halka açılmadan önce
  CAPTCHA (Auth → Attack Protection) açılmalıdır.
- Supabase'in varsayılan e-posta servisi yalnızca proje ekibine posta gönderir;
  gerçek kullanıcılar için özel SMTP ayarlanmalıdır (bkz. `supabase/README.md`).
- Defter fotoğrafları kişisel veri (müşteri adları) içerir. Üçüncü tarafa
  gönderilmez ama işlenmek üzere kısa süre Supabase'de ve yöneticinin
  bilgisayarında bulunur; KVKK aydınlatma metninde belirtilmelidir.
- Takma ad ve şehir araştırma verisidir. Açık rıza metni, saklama süresi ve silme
  prosedürü proje sorumlusu tarafından ayrıca yönetilmelidir.
- Public kayıt açılacaksa Supabase CAPTCHA, Auth rate limit ve sızmış parola
  koruması Dashboard'dan etkinleştirilmelidir.

## Anahtar olayı

Bir secret key istemciye veya Git geçmişine girerse yalnızca dosyadan silmek
yeterli değildir. Anahtar Supabase/sağlayıcı panelinden derhal döndürülür, oturumlar
gerekirse iptal edilir ve yeni build yayımlanır.

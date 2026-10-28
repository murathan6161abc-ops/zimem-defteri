# Supabase düzeni

Bu klasördeki tek şema kaynağı `migrations/` dizinidir. Eski bağımsız
`schema.sql` ve sıkılaştırma dosyaları kaldırılmıştır; böylece kurulum sırası ve
canlı şema birbirinden kopmaz.

## Yerel doğrulama

```bash
npm install
npx supabase start
npx supabase db reset
npx supabase db lint
```

Docker çalışmıyorsa uygulama kontrolleri yine `npm run check` ile yapılabilir.

## Canlı projeye uygulama

```bash
npx supabase login
npx supabase link --project-ref kctlcitdjyvpibdwrssj
npx supabase db push
```

Göçten sonra `assign_admin.sql.example` içindeki kullanıcı adını kontrol edip SQL
Editor'de çalıştır. Kullanıcı yeniden giriş yaptığında yeni `app_metadata` yetkisi
JWT'ye geçer.

Frontend yalnızca publishable key kullanır. Secret/service-role key hiçbir
`NEXT_PUBLIC_` değişkenine veya APK'ya konmaz.

## Defter tarama, şifre sıfırlama ve 2 adımlı doğrulama kurulumu

Uygulama kodu hazırdır; aşağıdaki adımlar bir kez yapılır.

### 1. Veritabanı (SQL Editor)

Sırayla çalıştır (hepsi tekrar çalıştırılabilir):

1. `migrations/20260926120000_scan_jobs.sql` — tarama iş kuyruğu + tarama bilgisayarı nabzı
2. `migrations/20260926130000_account_security.sql` — 2FA zorunluluğu + kullanıcı adı koruması
3. `migrations/20260926140000_merchant_debt_delete.sql` — esnafın kendi açık borcunu silmesi

### 2. Tarama bilgisayarı (yerel model, Gemini/Google yok)

Defter fotoğrafları yöneticinin bilgisayarında [Ollama](https://ollama.com) ile çalışan
yerel bir görsel modelle okunur. Bilgisayar dışarıya port açmaz; Supabase'deki
`scan_jobs` kuyruğunu izler, fotoğrafı okur, sonucu yazar ve fotoğrafı siler.
Tarama yalnızca bu program açıkken çalışır; uygulama durumu tarama ekranında gösterir.

```bash
brew install ollama            # bir kez
ollama serve                   # ya da Ollama uygulamasını aç
ollama pull qwen3.5:9b         # bir kez, ~6.6 GB
npm run tarama:kurulum         # bir kez: tarama hesabını oluşturur (.env.tarama)
```

Ardından SQL Editor'de `assign_scan_worker.sql.example` dosyasını çalıştır (hesaba
`scan_worker` yetkisi verir) ve programı başlat:

```bash
npm run tarama
```

Terminal kullanmak istemezsen `scripts/tarama-baslat.command` dosyasına çift tıkla:
Ollama kapalıysa açar ve programı başlatır. Masaüstüne kısayolunu sürükleyebilirsin.

### Borç türleri ve ikonlar (v2.7.0)

SQL Editor'de `migrations/20260928120000_debt_kind_icon.sql` dosyasını çalıştır
(masaüstündeki `D-Zimem/tur-ve-ikon.sql` ile aynı). `merchant_debts` tablosuna
`kind` (bebek, temizlik, giyim, yakacak, ulaşım… 10 tür) ve `icon` sütunlarını ekler.
`category` sütunu araştırma grubu olarak (gida/egitim/fatura/saglik) aynen kalır;
tür her zaman kendi grubuyla kaydedilir (ör. yakacak → fatura). SQL çalıştırılmadan
da uygulama çalışır, yalnızca tür ve ikon sunucuda saklanmaz.

**Okuma doğruluğu.** Program (`scripts/ledger-reader.mjs`) modele hesap yaptırmaz: model
yalnızca satırları okur (ad, ürün, tutar, borç/ödeme/toplam/"ödendi", üstü çizili mi);
toplama, kısmi ödeme düşme ve müşteri gruplama kodla yapılır. Modelin emin olmadığı
rakamlar ve defterde yazan toplamla tutmayan hesaplar uygulamada "Kontrol et" diye
işaretlenir ve kendiliğinden seçilmez. Kendi defter fotoğraflarınla doğruluğu ölçmek için
fotoğrafları `tarama-test/` klasörüne koy (git'e girmez) ve çalıştır:

```bash
npm run tarama:test
```

Doğru cevabı biliyorsan fotoğrafın yanına aynı adla `.json` koy
(`{"entries":[{"ref":"A.Y.","amount":130},{"ref":"M.K.","amount":90,"paid":true}]}`);
araç kaç borcun doğru okunduğunu puanlar.

Model değiştirmek için `.env.tarama` içindeki `OLLAMA_MODEL` satırını düzenle
(ör. daha hızlı ama daha az doğru `qwen3.5:4b`). `.env.tarama` gizlidir, git'e girmez.

### 3. Authentication ayarları

- **Multi-Factor → TOTP**: Enabled (varsayılan açıktır, kontrol et).
- **Providers → Email → Confirm email**: KAPALI kalmalı (eski kullanıcı-adı hesapları ve
  tarama hesabı sentetik e-postayla açılır; yeni kayıtlar zaten 6 haneli kodla doğrulanır).
- **Providers → Email → Secure email change**: KAPALI olmalı. Açıksa e-posta değişikliğinde
  eski (sentetik, var olmayan) adrese de onay gider, Gmail "adres bulunamadı" diye geri
  döndürür ve değişiklik hiçbir zaman tamamlanamaz.
- **Emails → SMTP Settings**: Özel SMTP'yi aç. Varsayılan servis yalnızca proje ekibine
  posta gönderir. Gmail örneği: host `smtp.gmail.com`, port `465`, kullanıcı Gmail adresin,
  şifre Google hesabında oluşturulan **Uygulama şifresi**.
- **Emails → Templates**: Uygulama bağlantı değil **6 haneli kod** kullanır. Şu dört
  şablonun hepsine aynı içeriği koy — **Confirm signup**, **Magic Link**,
  **Change Email Address**, **Reset Password**. Konu: `D-Zimem doğrulama kodun`, içerik:

  ```html
  <h2>D-Zimem</h2>
  <p>Hesabın için doğrulama / şifre sıfırlama kodun:</p>
  <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
  <p>Bu isteği sen yapmadıysan bu e-postayı yok say.</p>
  ```

  (Yeni kayıt kodu "Magic Link" şablonuyla gider; "Confirm email" açılırsa "Confirm signup".)

### 4. Google ile giriş

1. [Google Cloud Console](https://console.cloud.google.com) → yeni proje → **APIs & Services →
   OAuth consent screen**: User type **External**, uygulama adı `D-Zimem`, destek e-postası;
   kapsamlar yalnızca `email`, `profile`, `openid`. Test bitince **Publish app**.
2. **Credentials → Create credentials → OAuth client ID** → tür **Web application** →
   Authorized redirect URI: `https://kctlcitdjyvpibdwrssj.supabase.co/auth/v1/callback`.
   Oluşan **Client ID** ve **Client secret**'ı kopyala.
3. Supabase → **Authentication → Sign In / Providers → Google**: etkinleştir, Client ID ve
   secret'ı yapıştır → Save.
4. Supabase → **Authentication → URL Configuration → Redirect URLs**: ekle
   `com.dzimem.app://login-callback` (APK) ve web sürümünü kullanıyorsan onun `/login/` adresi
   (ör. `http://localhost:3939/login/`).

APK'da giriş telefonun tarayıcısında açılır (Google uygulama içi WebView'de girişi engeller)
ve `com.dzimem.app://login-callback` ile uygulamaya dönülür; oturum PKCE koduyla açılır.
Google ile ilk girişte kullanıcıdan rol, takma ad ve araştırma onamı alınır. Aynı e-postayla
açılmış bir hesap varsa Supabase Google girişini o hesaba bağlar.

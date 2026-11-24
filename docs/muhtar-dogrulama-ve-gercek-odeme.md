# Muhtar doğrulaması ve esnafa doğrudan gerçek ödeme (2.10.0)

## Özet

- **Para uygulamadan geçmez.** Vatandaş borcu üstlenir, bir ödeme kodu (ör. `DZ-0F63A6`) alır ve parayı dükkânda elden ya da esnafın IBAN'ına havaleyle **doğrudan esnafa** öder.
- **Borç, esnaf "Parayı aldım" deyince** sunucuda düşer ya da kapanır. "Almadım" derse borç değişmez.
- **Gerçek ödeme yalnızca muhtar onaylı borçlarda ve 18 yaş ve üzeri hesaplarda** açıktır.
- **Onaylı borçlar simülasyon ödemesiyle kapatılamaz.** Böylece gerçek bir aile borcu, para ödenmeden "kapandı" görünmez.
- **Onay bekleyen borçlarda ve örnek borçlarda araştırma akışı aynen sürer:** ön test, simülasyon ödemesi, son test.
- **Gerçek ödemeler araştırma verisine yazılmaz.** Anket sorulmaz, XP verilmez.

## Kurulum (bir kez)

1. Supabase → SQL Editor'de `supabase/migrations/20261124120000_muhtar_verification_direct_payment.sql` dosyasını çalıştırın.
2. Mevcut tüm borçlar "onay bekliyor" durumuna geçer. Araştırma akışı bundan etkilenmez.

## Akış

| Adım | Kim | Nerede |
|---|---|---|
| 1. Borcu ekler | Esnaf | Esnaf paneli. Borç "⏳ Muhtar onayı bekleniyor" olarak görünür. |
| 2. (İsteğe bağlı) IBAN ve hesap sahibini girer | Esnaf | Esnaf paneli → "Havale bilgileri". IBAN yalnızca ödeme kodu alan kişiye gösterilir. |
| 3. Haneyi ve esnafı yerinde teyit eder, imzalı ve mühürlü formu doldurur | Muhtar | Kâğıt form |
| 4. Formu görüp borcu onaylar ya da reddeder | Yönetici | `/admin` → "Muhtar doğrulaması". "Muhtarlık ve form no" yazılması zorunludur. |
| 5. "💳 Esnafa öde" düğmesiyle ödeme kodu alır, parayı esnafa öder | Vatandaş (18+) | Ana sayfa → "Ödemelerim" |
| 6. (Havalede) havaleyi yapınca "📩 Parayı gönderdim" der | Vatandaş | Ödemelerim. Bu ödeme artık iptal edilemez ve süresi dolmaz. |
| 7. Bankasına bakıp "Parayı aldım" ya da "Almadım" der | Esnaf | Esnaf paneli; bekleyen ödemeler sayfanın en üstünde uyarıyla görünür, "gönderildi" denenler öne çıkar. |
| 8. Takılan ödemeleri takip eder | Yönetici | `/admin` → "Takılan ödemeler" |

## Borcun ödendiği nasıl anlaşılır?

- **Uygulama bankayı göremez.** Bunun için açık bankacılık lisansı gerekir. Havalenin gelip gelmediğini esnaf, hesabına düşen havalenin açıklamasındaki kodu uygulamadaki kodla eşleştirerek anlar.
- **Borç ancak esnaf "Parayı aldım" deyince düşer ya da kapanır.** Ödeyen kişiye "Esnaf aldı ✔" bildirimi gider.
- **Anlaşmazlıklar uygulama dışında çözülür:**
  - Esnaf 3 günden uzun süre onaylamazsa ya da "almadım" derse ödeme yönetici panelindeki **"Takılan ödemeler"** listesine düşer.
  - Proje ekibi esnafı arar; ödeyen kişi banka dekontunu ve ödeme kodunu ekibe gösterir.
  - Dekont uygulamaya yüklenmez. İçinde ödeyenin adı ve hesap bilgisi olduğu için KVKK açısından uygulamada saklanmaması daha doğrudur.

## Kurallar (veritabanında uygulanır)

- **Doğrulama:**
  - Borcu "onaylı" yapabilen tek kişi yöneticidir. Esnaf borç eklerken durumu kendisi değiştiremez.
  - Örnek borçlar ve sahibi olmayan borçlar onaylanamaz.
  - Muhtarlık ve form numarası ayrı, yalnızca yöneticinin okuyabildiği bir tabloda tutulur. **Borçlunun adı hiçbir yere yazılmaz.**
- **Ödeme kodları:**
  - Bir kişinin aynı anda en çok 3 bekleyen ödeme kodu olabilir.
  - Kodu alınmış tutar 7 gün boyunca ayrılmış sayılır, böylece aynı borca fazla para gönderilmez. "Gönderdim" denmiş havale, esnaf sonuçlandırana kadar süresiz ayrılmış kalır ve iptal edilemez.
  - Bekleyen ödemesi olan borç silinemez.
  - Borç kapanınca ya da onayı kaldırılınca bekleyen kodlar iptal edilir.
- **Güvenlik:**
  - Ödeme kayıtlarını yalnızca ödeyen, ilgili esnaf ve yönetici görür. IBAN'ı yalnızca sahibi ve ödeme kodu alan kişi görür.
  - 2 adımlı doğrulama açık hesaplarda tüm bu işlemler 2 adımlı oturum ister.

## Sınırlar

- **Yaş beyana dayanır.** 18 yaş kontrolü, kayıtta beyan edilen yaş grubuna göre yapılır; kimlik doğrulaması yoktur.
- **Para hareketi doğrulanmaz.** Uygulama ödemenin gerçekten yapıldığını kendisi doğrulamaz; esnafın beyanına dayanır. Bu, paranın uygulamadan geçmemesinin bilinçli bir sonucudur.
- **Onay bekleyen borçlar simülasyonla kapanabilir.** Bu borçlar, eskiden olduğu gibi simülasyon ödemesiyle kapatılabilir. Gerçek esnaf borçlarının araştırma sırasında da simülasyonla kapanmaması isteniyorsa ayrıca karar verilmelidir.

## Gerekli belgeler

Ayrıntılar danışmanla konuşulmalıdır.

- **Muhtar doğrulama formu** (her borç için; muhtar imzası ve mühür): Formda uygulamadaki borç numarası (yönetici panelindeki 8 haneli kısa kimlik), esnaf, tutar, tarih ve "yerinde teyit ettim" beyanı yer alır.
- **Muhtar gönüllü katılım ve gizlilik taahhüdü.**
- **Borçlu hane rıza formu:** Muhtarın ziyaret etmesine ve borcun kimliksiz yayınlanmasına izin verilir. Rıza her an geri çekilebilir.
- **Esnaf katılım sözleşmesi:** Esnaf; borcun gerçek olduğunu, ödeme gelince onaylayacağını ve fazla ödemeyi iade edeceğini kabul eder. IBAN paylaşımına da izin verir.
- **Kullanım koşulları ve KVKK aydınlatma metni:** Ödemenin bir bağış olduğu, uygulamanın para almadığı ve 18 yaş sınırı yazılır.

# D-Zimem — 2204-A Yol Haritası

> 18 Kasım 2026'da hazırlandı. Son başvuru **4 Ocak 2027 Pazartesi, saat 17:30**. **47 gün** kaldı.
> Yapay zekâ desteğiyle hazırlanmış bir planlama aracıdır. Raporun iş-zaman çizelgesine gerçekte yaptıklarınızı yazın.
> İlgili dosyalar: kurallar için `docs/2204a-uyum-notlari.md`, kaynaklar için `docs/literatur-taramasi.md`. Ekibin hazırladığı `docs/TUBITAK-2204A.md` dosyası (`v2.7.0-onam-ve-yas` dalında) teknik adımları içeriyor. Bu yol haritası onunla birlikte kullanılmalı.

## Önce bu karar: ana alan (en geç 21 Kasım Cumartesi)

Uygulamanın araştırma altyapısı bir **Psikoloji** projesine göre kurulmuş: huzur maddesi, PANAS, WHO-5, istatistik paneli ve onam formlarındaki "iyiliğin duygu durumuna etkisi" açıklaması. `docs/TUBITAK-2204A.md` de Psikoloji'yi öneriyor. Siz ise 28 Ekim'de **Değerler Eğitimi** dediniz. Ana alan ile ölçülen şey uyuşmazsa ön değerlendirmede "ana alan uyumu" puanı düşer. Bu kriter, 20 puanlık "problem ve araştırma sorusu" bölümünün içinde.

| | Psikoloji | Değerler Eğitimi |
|---|---|---|
| Ana soru | Anonim (simüle) iyilik, yapan kişinin duygu durumunu iyileştiriyor mu? | Uygulama, yardımseverlik değerini güçlendiriyor mu? |
| Ölçüm | Hazır: huzur, PANAS, WHO-5. Yalnızca PANAS'ın iki alt ölçeği hem ön hem son testte sorulmalı (küçük bir kod değişikliği). | Yeni: Türkçe geçerliği olan bir yardımseverlik ölçeği bulunmalı, izin alınmalı, uygulamaya ya da kâğıda eklenmeli. |
| Veri toplama | Tek oturum: ön test, iyilik, son test. Aralık ortasında başlansa bile yetişebilir. | Ön test ile son test arasında en az 3 hafta gerekir. Ön test en geç **1 Aralık**'ta yapılmalı. |
| Onam formları | Neredeyse hazır | Araştırma açıklaması yeniden yazılmalı |
| 47 güne sığmama riski | Düşük–orta | Yüksek |

Karar sizin ve danışmanınızın. Değerler Eğitimi'nde kalırsanız ölçeği bu hafta bulmanız şart, çünkü MEB izni ve formlar ona bağlı.

## Kritik tarihler

| Tarih | O güne kadar bitmiş olması gereken |
|---|---|
| 21 Kasım Cumartesi | Ana alan, tematik alan, ölçme araçları ve katılımcı grupları kesinleşmiş |
| 25 Kasım Çarşamba | MEB Araştırma Uygulama İzni başvurusu yapılmış (öğrenci, öğretmen ya da veli katılacaksa) |
| 28 Kasım Cumartesi | Uygulama dondurulmuş, son sürüm APK dağıtıma hazır |
| 1 Aralık Salı | Değerler Eğitimi seçildiyse ön test başlamış |
| 22 Aralık Salı | Veri toplama bitmiş |
| 28 Aralık Pazartesi | Analiz bitmiş |
| 2 Ocak Cumartesi | TYBS başvurusu yapılmış ve onaylanmış (hedef) |
| 4 Ocak Pazartesi 17:30 | Sistem kapanır, artık değişiklik yapılamaz |

## Adım adım

### 1. Ekip ve hesaplar (bu hafta)

- [ ] Ekibi kesinleştirin: en fazla 3 öğrenci ve en fazla 1 danışman. Danışman MEB'e bağlı bir okulda çalışan bir öğretmen ya da Deneyap eğitmeni olmalı.
- [ ] Koda ve projeye katkı veren herkes ya ekipte olmalı ya da raporda "destek alınan kişi" olarak belirtilmeli (Rehber 2.3).
- [ ] ARBİS: her öğrenci ve danışman kayıt olsun, kimlik bilgilerini güncellesin, İletişim bölümünde e-posta, telefon ve adresi eksiksiz doldursun. Sitedeki 2026 v2 kılavuzunu kullanın ve bunu son güne bırakmayın.
- [ ] Yaş sınırı: her öğrenci 4 Ocak 2027 itibarıyla 20 yaşından gün almamış olmalı.
- [ ] Öğrenciler ve danışman farklı illerdeyse TYBS'de bunun gerekçesini yazmanız gerekecek.

### 2. Uygulamayı dondurun (18–28 Kasım)

- [ ] En güncel kod `v2.7.0-onam-ve-yas` dalında, `main` geride kaldı. Araştırmada kullanılacak sürümü tek bir dalda birleştirin.
- [ ] Ölçüm değişikliğini yapın. Psikoloji seçerseniz PANAS'ın iki alt ölçeği hem ön hem son testte sorulsun. Değerler Eğitimi seçerseniz yardımseverlik ölçeğini ekleyin.
- [ ] Onam formlarındaki ve aydınlatma metnindeki araştırma açıklamasını son tasarıma göre güncelleyin.
- [ ] Bekleyen Supabase adımlarını tamamlayın ve APK'yı dağıtıma hazırlayın (`docs/TUBITAK-2204A.md`, "Bekleyen teknik adımlar").
- [ ] Uygulamayı birkaç cihazda deneyin. Deneme verisini gerçek araştırma verisinden ayırın.
- [ ] Bu tarihten sonra büyük değişiklik yapmayın. İzin hangi araç için alındıysa veri de o araçla toplanmalı.

### 3. İzinler ve formlar (18 Kasım'dan izinler gelene kadar)

- [ ] **Ölçek izni:** Kullanacağınız her Türkçe ölçeğin geliştiricisine e-posta atın. Yanıtları saklayın ve Ekler'e koyun.
- [ ] **İmzalı formlar:** Gönüllü katılım ve veli onam formlarını (uygulamadaki `/onam-formlari` sayfası) danışmanınızla gözden geçirin. Katılımcılara kâğıt üzerinde imzalatın ve güvenli bir yerde saklayın. Bu formları repoya ya da internete yüklemeyin.
- [ ] Uygulamadaki onay kutusunun imzalı formun yerine geçip geçmediğini 2204a@tubitak.gov.tr adresine sorun. Yanıt gelene kadar kâğıt formları imzalatmaya devam edin.
- [ ] **MEB izni:** Katılımcılar arasında öğrenci, öğretmen ya da veli varsa arastirmaizinleri.meb.gov.tr üzerinden MEB Araştırma Uygulama İzni alın. Başvuruda genellikle ölçeklerin ve formların son hâli istenir, sistemdeki listeyi kontrol edin. Gelen izin belgesini TYBS'ye PDF olarak yükleyin.
- [ ] MEB dışı bir kurum aracılığıyla çalışıyorsanız (ör. bir esnaf odası) o kurumdan da izin belgesi alın.
- [ ] İzin gelmeden öğrenci, öğretmen ya da velilerden veri toplamayın.
- **İzin gecikirse B planı:** Okul aracılığıyla ulaşılmayan yetişkinler ve esnafla devam edin. Bu durumda 18 yaş altı katılımcı olmaz. MEB izni gerekmez ama imzalı katılım formu yine gerekir. Bu seçeneği danışmanınızla şimdiden konuşun.

### 4. Veri toplama

- **Psikoloji yolu:** Ekibin güç analizine göre en az 34 katılımcıdan eksiksiz ön ve son test gerekiyor. Arada katılımcı kaybı olacağı için 40–45 kişiye ulaşmayı hedefleyin. Her katılımcı tek oturumda tamamlar.
- **Değerler Eğitimi yolu:** Ön test en geç 1 Aralık'ta yapılır, ardından en az 3 hafta kullanım gelir, son test 22 Aralık civarında yapılır. Mümkünse uygulamayı kullanmayan ya da oyunlaştırmasız sürümü kullanan bir karşılaştırma grubu kurun.
- [ ] Ön ve son testi katılımcı koduyla eşleştirin (panel K001, K002 gibi kodlar veriyor). İsim kullanmayın.
- [ ] Katılımcı verisini hiçbir yapay zekâ aracına vermeyin, bana da. TÜBİTAK'ın yapay zekâ rehberi bunu yasaklıyor.

### 5. Analiz (22–28 Aralık)

- [ ] Analizi katılımcı düzeyinde yapın, yani her kişi için tek bir ortalama kullanın.
- [ ] Paneldeki sonuçları bağımsız, ücretsiz bir istatistik programıyla (ör. JASP ya da jamovi) doğrulayın.
- [ ] Ölçeklerin kendi verinizdeki güvenirliğini (Cronbach alfa) raporlayın.
- [ ] Sonuç ne çıkarsa çıksın olduğu gibi raporlayın. Beklenen sonucun çıkmaması proje için sorun değildir.

### 6. Literatür (şimdiden 20 Aralık'a kadar)

- [ ] Seçtiğiniz ana alana göre öncelikli kaynakları bulun (literatür dosyasındaki öncelik tablosu). Psikoloji seçerseniz eksen 2, 3 ve 4 öne çıkar.
- [ ] Her kaynağı orijinalinden okuyun ve doğrulama tablosunda işaretleyin.
- [ ] Giriş bölümünü kendiniz yazın. Bilimsel makalelere dayansın, D-Zimem'in benzer uygulamalardan farkını göstersin, araştırma sorusu ve hipotezle bitsin. Tarihçe kısa tutulsun.

### 7. Rapor (20 Aralık – 1 Ocak)

- [ ] Proje Yazım Şablonu'nu kullanın: Times New Roman 12 punto, her yandan 2,5 cm kenar boşluğu, tek satır aralığı, iki yana yaslı. Tüm başlıklar dahil 2–20 sayfa, Türkçe, tek PDF.
- [ ] Proje adı en fazla 15 kelime. Özet 150–250 kelime ve kaynak içermez. Anahtar kelime en fazla 5.
- [ ] Yapay Zekâ Araçları Kullanım Beyanı'nı doldurun: kod, metin ve literatür dahil kullandığınız bütün araçlar, amaçları, kapsamları ve çıktıları nasıl doğruladığınız.
- [ ] İş-zaman çizelgesine gerçekte yaptığınız işleri ve tarihlerini yazın.
- [ ] Sınırlılıkları yazın: ödemenin simülasyon olması, öz bildirime dayalı ölçüm, gönüllü katılım, küçük örneklem. Tarama özelliğinin doğruluğu sentetik sayfalarla ölçüldüyse onu da belirtin.
- [ ] Ekler: boş form örnekleri, ölçekler, veri sözlüğü, izin belgeleri ve yazışmalar. Hiçbirinde kişisel veri olmamalı. 20 sayfaya sığmazsa TYBS'de Ek Belgeler bölümüne tek PDF olarak yükleyin (dosya adı en fazla 25 karakter, boyutu en fazla 10 MB).
- [ ] Marka ve kurum adlarını tanıtım yapar gibi değil, yalnızca gerektiği kadar ve tarafsız bir dille anın.
- [ ] Göndermeden önce benzerlik (intihal) kontrolü yapın.
- [ ] İsteğe bağlı: uygulamanın çalıştığını gösteren bir video hazırlayın (en fazla 3 dakika, 10 MB, mp4).

### 8. TYBS başvurusu (hedef 2 Ocak)

- [ ] tybs.tubitak.gov.tr adresinde Açık Çağrılar listesinden 2204-A'yı bulup "Süreci Başlat"a basın. Başvuruyu bir öğrenci açar, diğer öğrencileri ve danışmanı kendisi ekler.
- [ ] Proje Bilgileri sayfasını doldurun: proje adı büyük harflerle, ana alan ve tematik alan (sonradan değiştirilemez), gerekiyorsa il gerekçesi, anahtar kelimeler, özet (formül içeremez).
- [ ] Proje Dosyaları sayfasına raporun PDF'ini yükleyin. Varsa Ek Belgeleri, videoyu ve MEB izin belgesini de ekleyin.
- [ ] "Onayla"ya basın. Onaydan sonra düzenleme yaparsanız onayı kaldırıp yeniden onaylayın. Onaysız kalan başvuru değerlendirmeye alınmaz.
- [ ] Başvuru çıktısını indirip saklayın.

### 9. Başvurudan sonra

- Başvuru, kapanıştan sonraki 3 iş günü içinde dilekçeyle geri çekilebilir.
- Süreç ön değerlendirme, bölge sergisi ve final aşamalarından oluşur. Bölge puanında ön değerlendirme puanının %30'u sayılır.
- Bölgeye davet edilirseniz:
  - ARBİS'e kendi adınıza açılmış vadesiz bir TL hesabının IBAN'ını girin. 18 yaş altındaysanız velinizin hesabı girilebilir. Papara gibi dijital hesaplar kabul edilmiyor.
  - İstenen formları hazırlayın.
  - Sözlü sunum ve poster hazırlayın. Ekipteki tüm öğrencilerin sergide bulunması zorunlu.
- Sergide puanın 40'ı sunum ve projeye hakimiyetten geliyor. Kodu, istatistikleri ve kaynakları kendiniz anlatabilmelisiniz.

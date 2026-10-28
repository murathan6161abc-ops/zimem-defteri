# D-Zimem — 2204-A Uyum Notları

> Bu dosya, 2204-A belgelerinde D-Zimem projesini ve literatür taramasını etkileyen kuralları özetler. Yapay zekâ (ÜYZ) desteğiyle hazırlanmıştır (bkz. "Yapay zekâ kullanımı" bölümü). Karar vermeden önce her zaman asıl belgeye bakın.

## Dayanılan belgeler (28.10.2026 itibarıyla)

| Belge | Not |
|---|---|
| 2204-A Çağrı Duyurusu 2026-2027 | Yüklenen "onaya sunulan v2" taslak, sitede yayımlanan metinle birebir aynı |
| TYBS Başvuru Kılavuzu 2026-2027 | Başvuru ekranları |
| ARBİS Kullanım Kılavuzu | Yüklenen sürüm 2025 v3. Sitede 2026 v2 var, güncel olanı kullanın |
| 2204-A Proje Rehberi 2027 | Tematik alanlar, rapor yazımı, etik, alanlara özel notlar |
| Proje Yazım Şablonu 2026-2027 (.docx) | Rapor biçimi ve yapay zekâ beyanı |
| Ön değerlendirme ve sergi kriterleri (2025) | Puan ağırlıkları |
| TÜBİTAK Üretken Yapay Zekâ Rehberi v04 (Ocak 2026) | Yapay zekâ kullanım kuralları |

Yarışma sayfası: https://tubitak.gov.tr/tr/yarismalar/icerik-lise-ogrencileri-arastirma-projeleri-yarismasi

## Tarih

- Başvurular 23 Eylül 2026'da açıldı ve **4 Ocak 2027 saat 17:30**'da kapanıyor. Sistem bu saatte kapanır, sonrasında hiçbir değişiklik kabul edilmez (Çağrı 4.2.14).
- Başvuru anında proje **tamamlanmış** olmalı. Fikir aşamasındaki ya da hâlâ süren projelerle başvurulamaz (Çağrı 4.1.7). Yani veri toplama ve analiz bu tarihten önce bitmeli.

## Elenme riskleri ve D-Zimem için anlamı

Ön değerlendirme ve sergi formları şu durumlarda projenin eleneceğini söylüyor: etik izin belgesi eksikliği, veri uydurma veya çarpıtma, kaynak göstermeme, kişisel verilerin gizliliğinin ihlali, çalışmanın ekip tarafından yapılmadığının anlaşılması.

| Kural | Kaynak | D-Zimem için anlamı |
|---|---|---|
| Gerekli etik izin ve onamlar alınmalı | Çağrı 4.1.12, 4.2.7–4.2.9 | Uygulama kişilerden ölçek verisi topluyor. Bu, insanlarla yapılan bir araştırma. Her katılımcıdan **imzalı gönüllü katılım formu**, 18 yaş altındakiler için **imzalı veli onam formu** gerekiyor. Katılımcılar öğrenci, veli, öğretmen gibi MEB paydaşlarıysa **MEB Araştırma Uygulama İzni** (arastirmaizinleri.meb.gov.tr) alınıp TYBS'ye yüklenmeli. Veri MEB dışı bir kurumda toplanıyorsa o kurumdan izin belgesi gerekiyor. İzin ve onam alınmadan toplanan veriyi raporda kullanmak elenme riski taşır. |
| Başkasının geliştirdiği ölçek için kullanım izni | Rehber 3.6.3, 3.6.8 | PANAS ve WHO-5'in Türkçe formları için geliştiricilerinden izin alınıp yazışmalar saklanmalı. |
| Kişisel verilerin gizliliği | Kriter formları; Çağrı 4.2.5 | Raporda, eklerde ve dosya adlarında kişisel veri olmamalı. Katılımcı verisi yapay zekâ araçlarına verilmemeli (ÜYZ Rehberi 1.5.3). |
| Kaynak gösterme ve intihal | Çağrı 5.2.2; Rehber 2.3 | Raporlar intihal yazılımıyla taranıyor. İntihal tespit edilirse öğrenci ve danışman 3 yıl TÜBİTAK etkinliklerinden men ediliyor. Kaynaklar APA ile gösterilmeli, metin kendi cümlelerinizle yazılmalı. |
| Çalışmayı ekip kendisi yapmalı | Kriter formları; Rehber 2.3 | Rapor metni öğrenciler tarafından yazılmalı. Kod dahil her parçayı ekip açıklayabilmeli. Sergide puanın 40'ı "sunum ve projeye hakimiyet"ten geliyor. |
| Daha önce veya başka bir yarışmaya başvurulmuş proje kabul edilmez | Çağrı 4.1.8, 4.1.9 | D-Zimem başka bir yarışmaya gönderildiyse bu bir elenme sebebi. |
| Kurum, firma, ürün ya da marka öne çıkarılamaz; ayrımcı veya dışlayıcı ifade kullanılamaz | Çağrı 4.1.11 | e-Zimem ve MÜSİAD gibi örnekler yalnızca kaynak olarak, tarafsız bir dille anılmalı. Teknoloji markaları tanıtır gibi yazılmamalı. Geleneğin dini ve kültürel arka planı betimleyici bir dille anlatılmalı. |
| Ana alan ve tematik alan başvurudan sonra değiştirilemez | Çağrı 4.1.13 | Ana alan, destek alınan alanlara göre değil, projenin konusu ve nihai amacına göre seçilmeli. |
| Öğrenci ve danışman farklı illerdeyse gerekçe yazılmalı | Çağrı 4.2.11 | Gerekçe kabul edilmezse proje elenir. |
| Onay kaldırılıp yeniden verilmezse başvuru değerlendirilmez | Çağrı 4.2.13 | Düzenlemeden sonra mutlaka yeniden "Onayla" butonuna basılmalı. |

## Rapor biçimi (Proje Yazım Şablonu; Çağrı 4.2.4–4.2.6)

- Türkçe, tek PDF, tüm başlıklar dahil 2–20 sayfa.
- Times New Roman 12 punto, her yandan 2,5 cm kenar boşluğu, tek satır aralığı, iki yana yaslı.
- Proje adı en fazla 15 kelime. TYBS'ye büyük harfle girilir ve kapanıştan sonra düzeltilemez.
- Özet 150–250 kelime, kaynak ve yorum içermez. Anahtar kelime sayısı en fazla 5.
- Bölümler sırasıyla: Ana alan, Tematik alan, Proje adı, Yapay Zekâ Araçları Kullanım Beyanı, Özet, Anahtar kelimeler, Amaç, Giriş, Yöntem, İş-zaman çizelgesi, Bulgular, Sonuç ve tartışma, Öneriler, Kaynaklar (APA), Ekler.
- İzin belgeleri, formlar ve anketler Ekler'e konur. 20 sayfaya sığmazsa TYBS'de "Ek Belgeler" bölümüne tek PDF olarak yüklenir. Dosya adı en fazla 25 karakter olmalı, kişisel bilgi içermemeli, boyutu 10 MB'ı geçmemeli.
- Tanıtım videosu isteğe bağlı: en fazla 3 dakika, 10 MB, mp4. TYBS kılavuzu bunu yazılımın gerçekten çalıştığını göstermek için öneriyor.

## Literatür taramasına etkisi

- **Giriş bölümü kaynak taramasıdır.** Bilimsel makalelere dayanmalı. Benzer çalışmalardan farkınızı, doldurduğunuz boşluğu ve onlardan nasıl yararlandığınızı anlatmalı. Bölüm, araştırma sorusu ve hipotezle bitmeli (Rehber 3.3).
- **Tarihçe kısa tutulmalı.** Şablon, değerlendirmeye katkısı olmayan genel konu ve tarihçe anlatımlarından kaçınmayı istiyor. Zimem geleneği (eksen 1) Giriş'te kısa bir çerçeve paragrafı olmalı.
- **Puanlamadaki yeri:** Ayrı bir "literatür" puanı yok. Literatür dolaylı olarak üç kriteri besliyor: problem tanımı (ön değerlendirmede 20 puan), yaratıcılık ve etki (30), sonuç ve tartışma (30, bulgular literatürle karşılaştırılır). Sergide puanın 40'ı "sunum ve projeye hakimiyet"ten geliyor. Bu yüzden öğrenciler kaynakları bizzat okumuş ve anlamış olmalı.
- **Özgünlük:** e-Zimem (kamu eliyle) ve MÜSİAD (sivil toplum eliyle) gibi mevcut uygulamalar Giriş'te anılmalı ve D-Zimem'in onlardan farkı açıkça yazılmalı. Yazılım rehberi, başka bir projenin birebir ya da çok küçük farklarla tekrarlanmasını ihlal sayıyor (Rehber 3.6.12).

### Ana alana göre literatürün ağırlığı

| Ana alan (önerilen tematik alan) | Araştırma sorusu örneği | Literatürde ağırlık | Ek gereksinim |
|---|---|---|---|
| Psikoloji (Siber Psikoloji) | Anonim dijital iyilik, yapan kişinin huzurunu ve iyi oluşunu artırıyor mu? | Eksen 2, 3, 4 ve anonimlik | Ölçüm düzeltmeleri gerekli. Rehber, bir müdahalenin etkililiğinin test edilmesini ve mobil uygulamaları açıkça destekliyor (3.6.7). |
| Yazılım (Oyun ve Oyunlaştırma veya Yoksullukla Mücadele) | Anonim ve oyunlaştırılmış bir dijital zimem sistemi nasıl tasarlanır, ne kadar kullanışlı olur? | Eksen 5, 6; yazılım geliştirme modeli; mahremiyet | Geliştirme modeli, testler ve mevcut çözümlerle karşılaştırma gerekli (3.6.12). |
| Değerler Eğitimi (Değerler Eğitimi) | Uygulama, kullanıcıların yardımseverlik değerini güçlendiriyor mu? | Eksen 1, Özdemir (2023), değerler eğitimi literatürü | Yardımseverlik için geçerliği gösterilmiş bir ölçek ve daha uzun süreli bir uygulama gerekli. Yardımseverlik, rehberdeki 10 kök değerden biri (3.6.3). |
| Sosyoloji (Somut Olmayan Kültürel Miras) | Geleneğin dijital ortama taşınması, dayanışmaya katılımı nasıl etkiliyor? | Eksen 1, 5; toplumsal dayanışma kuramları | Dayanışmayı ölçen bir araç ya da nitel veri gerekli. |

## Yapay zekâ kullanımı

Dayanak: Proje Yazım Şablonu ("Yapay Zeka Araçları Kullanım Beyanı"), TÜBİTAK ÜYZ Rehberi v04 ve TYBS başvuru ekranındaki yapay zekâ metni onayı.

- **İzinli kullanımlar** (çıktının doğrulanması şartıyla): literatür arama ve özetleme, dil ve üslup desteği, kodlama yardımı, fikir geliştirme. Yapay zekânın verdiği özetler ve künyeler orijinal kaynaktan kontrol edilmeli, çünkü yapay zekâ uydurma kaynak üretebilir.
- **Dikkat gerektiren kullanım:** Giriş, literatür ya da yöntem bölümlerinin taslağını yapay zekâya yazdırmak. Böyle bir taslak asla nihai metin olamaz. Üstelik 2204-A'da projenin öğrenci tarafından yapılması şart.
- **Yasak kullanımlar:** intihal; veri uydurma ya da çarpıtma; sahte kaynak üretme; gizli, kişisel veya yayımlanmamış araştırma verisini yapay zekâ araçlarına girme.
- **Raporda beyan edilecekler:** aracın adı, sürümü ve erişim tarihi; kullanım amacı; kapsamı (hangi bölümde, ne ölçüde); insan müdahalesi (çıktıda ne değiştirildi, nasıl doğrulandı).

### Bu çalışmadaki yapay zekâ kullanım kaydı

| Tarih | Araç | Amaç | Çıktı |
|---|---|---|---|
| 28.10.2026 | Claude Code (Anthropic). Model ve sürüm bilgisi sohbette verildi. | Literatür arama ve özetleme, kaynak künyelerinin kontrolü, 2204-A belgelerinin özetlenmesi, uygulamadaki ölçeklerin incelenmesi | `docs/literatur-taramasi.md`, bu dosya |

Beyandaki "insan müdahalesi" kısmını ekip dolduracak: hangi kaynakların orijinalinden okunup doğrulandığı (bkz. `docs/literatur-taramasi.md`, kaynak doğrulama tablosu) ve notlarda nelerin değiştirildiği.

## Yapılacaklar (öncelik sırasıyla)

1. [ ] Ana alanı ve tematik alanı danışmanla birlikte kararlaştırın.
2. [ ] ARBİS: Her öğrenci ve danışman kayıt olsun, kimlik bilgilerini güncellesin, İletişim bölümünde e-posta, telefon ve adresi eksiksiz doldursun. Sitedeki 2026 v2 kılavuzunu kullanın.
3. [ ] Katılımcı kitlesini netleştirin (yaş, MEB paydaşı olup olmadığı). Gerekli izinleri buna göre başlatın. MEB izni gerekiyorsa hemen başvurun.
4. [ ] Gönüllü katılım formu ve veli onam formu hazırlayın, imzalatın ve saklayın. Uygulamadaki onay kutusunun imzalı formun yerine geçip geçmediğini 2204a@tubitak.gov.tr adresine sorun.
5. [ ] PANAS ve WHO-5 Türkçe formları için ölçek kullanım izni isteyin, yazışmaları saklayın.
6. [ ] Ölçüm düzeltmelerini veri toplamaya başlamadan önce yapın (bkz. `docs/literatur-taramasi.md`, "Ölçüm notları").
7. [ ] Veri toplamayı ve analizi 4 Ocak'tan önce bitirin.
8. [ ] Raporu şablonla yazın: özet, yapay zekâ beyanı ve APA kaynakça dahil. Göndermeden önce intihal kontrolü yapın.
9. [ ] İsterseniz en fazla 3 dakikalık bir tanıtım videosu hazırlayın.
10. [ ] TYBS başvurusunu son güne bırakmayın. Onayladıktan sonra düzenleme yaparsanız yeniden onaylayın.
11. [ ] Bölge veya final aşamasına kalırsanız ARBİS'e IBAN girin. Ticari ya da dijital hesaplar (Papara vb.) kabul edilmiyor. 18 yaş altındaysanız velinizin hesabı girilebilir.

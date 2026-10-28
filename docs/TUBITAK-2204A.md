# TÜBİTAK 2204-A hazırlık rehberi (2027 çağrısı)

Bu belge D-Zimem'in 2204-A Lise Öğrencileri Araştırma Projeleri Yarışması'na hazırlığını
toplar. Madde numaraları 2027 çağrı duyurusundandır (Ek-1b). Puanlama kriterleri çağrıda
değil, yarışmanın web sayfasında ve Proje Rehberi'nde yayımlanır; oradan da kontrol edin.

## Takvim

- TYBS kılavuzundaki ekran görüntüsünde 2204-A başvurusu **04.01.2027 17:30**'da kapanıyor
  (resmî tarihi yarışma sayfasından doğrulayın). Sistem kapanış günü 17:30'da kapanır (4.2.14).
- Proje **tamamlanmış** olmalı: veri toplanmış, analiz edilmiş, rapor yazılmış (4.1.7).
- Önerilen sıra: uygulamayı dondur → etik/MEB izni → veri toplama → analiz → rapor.
  İzin alındıktan sonra uygulamada yapılan büyük değişiklik yeniden onay gerektirebilir.

## Şartname maddeleri ve uygulamanın durumu

| Madde | Şart | Uygulamada | Sizin yapmanız gereken |
| --- | --- | --- | --- |
| 4.1.7, Hatırlatma | Proje öğrencilerin kendi bilgi ve becerisiyle yapılmalı | — | TYBS'deki **Yapay Zekâ Kullanım Beyanı**'nı doğru doldurun; kod ve analiz kararlarını sözlü sunumda açıklayabilecek düzeyde bilin |
| 4.1.11 | Raporda firma, ticari ürün ya da marka öne çıkarılmaz | Gerçek ödeme ve ödeme markası yok; ödeme simülasyondur | Raporda Supabase/Ollama gibi araçları yalnızca "kullanılan araçlar" olarak anın |
| 4.1.12 | Gerekli etik izinler alınmazsa proje elenir | — | Etik kurul onayı alın |
| 4.1.13 | Ana alan, projenin ana amacına göre seçilir | — | Ana amaç iyiliğin duygu durumuna etkisi → büyük olasılıkla **Psikoloji**; yazılım destek alanıdır |
| 4.2.4 | Rapor şablonla, Türkçe, tek PDF, 2–20 sayfa; özet 150–250 kelime | Yönetim panelindeki "Araştırma Özeti" rapora taslak verir | Proje Yazım Şablonu'nu kullanın |
| 4.2.5 | Ek belgeler tek PDF, ≤10 MB, dosya adı ≤25 karakter, kişisel bilgi yok | Anonim CSV ve veri sözlüğü panelden indirilir | Anket formu, onam formu boş örneği, veri sözlüğünü ek PDF'e koyun |
| 4.2.6 | Proje adı en fazla 15 kelime | — | |
| 4.2.7 | MEB paydaşlarıyla (öğrenci, veli, öğretmen) çalışılıyorsa MEB Araştırma Uygulama İzni | — | arastirmaizinleri.meb.gov.tr üzerinden başvurun; belgeyi TYBS'ye yükleyin |
| 4.2.8 | İmzalı gönüllü katılım formu; 18 yaş altı için imzalı veli onam formu | Kayıtta yaş grubu sorulur; 18 altı için veli onamı beyanı zorunlu. Yazdırılabilir formlar: `/onam-formlari` | Formları danışmanla düzenleyip imzalatın, saklayın; raporda belirtin |
| 4.2.10 | İsteğe bağlı tanıtım videosu (MP4, ≤3 dk, ≤10 MB) | — | Uygulamanın çalıştığını gösteren kısa bir video çekin |

## Araştırma tasarımı: öneriler

1. **PANAS ön-son karşılaştırması yapılamıyor.** Uygulama negatif duyguyu yalnızca ön testte,
   pozitif duyguyu yalnızca son testte soruyor. Ön-son değişim iddia edilecekse iki alt ölçek
   de iki ölçümde sorulmalı. Bu, ölçme aracını değiştirir; danışmanla karar verin ve etik
   başvurusundan **önce** uygulayın.
2. **Kontrol grubu.** Kontrol grubu olmadan "iyilik duygu durumunu iyileştirdi" diyemezsiniz.
   Oyunlaştırmasız sürüm (`NEXT_PUBLIC_GAMIFICATION=off`) bir karşılaştırma koşulu olarak
   kullanılabilir; kayıtlar `app_version` sonundaki `-oyunsuz` ekiyle ayrılır. Nötr görev
   yapan bir kontrol grubu ise ayrıca tasarlanmalıdır.
3. **Analiz birimi katılımcıdır.** Bir kişinin birden çok gönderimi bağımsız değildir.
   Yönetim paneli testleri katılımcı düzeyinde (kişi ortalaması) yapar; raporda da böyle verin.
4. **Örneklem büyüklüğü.** Orta etki (dz = 0.5), α = .05, güç = .80 için eşleştirilmiş t
   testinde yaklaşık 34 katılımcı gerekir (G*Power ile doğrulayın).
5. **Ölçeklerin Türkçe geçerliği.** PANAS ve WHO-5 için Türkçe geçerlik-güvenirlik
   çalışmalarını kaynak gösterin ve kendi verinizle Cronbach alfayı raporlayın (panelde var).
6. **Sınırlılıklar.** Simüle ödeme, öz-bildirim, öz-seçim, küçük örneklem.

## Yönetim panelinde hazır olanlar

- Betimsel özet (Markdown) + çıkarımsal istatistik: eşleştirilmiş t testi, Wilcoxon,
  Cohen dz, %95 güven aralığı, yaş gruplarına göre analiz, PANAS için Cronbach alfa.
  p değerlerini raporda kullanmadan önce JASP/SPSS ile doğrulayın.
- Anonim CSV (katılımcı kodu K001…, takma ad/şehir/başlık/hesap kimliği yok) ve veri sözlüğü.

## Bekleyen teknik adımlar

Supabase SQL Editor'de, sırayla ve daha önce çalıştırılmadıysa:

1. `20260928120000_debt_kind_icon.sql` (borç türü ve ikon sütunları)
2. `20261024100000_panas_empty_totals.sql` (PANAS atlanınca toplam 0 değil boş; mevcut 0'ları düzeltir)
3. `20261029120000_age_group_and_account_erasure.sql` (yaş grubu ve hesap silme)
4. `20261029130000_delete_account_requires_mfa.sql` (hesap silme 2FA ister)

Ayrıca:

- `.env.local` içinde `NEXT_PUBLIC_RESEARCH_CONTACT_EMAIL` aydınlatma metninde ve formlarda görünür.
- Katılımcılara **release APK** dağıtın (`npm run delivery:release`); imza anahtarının yedeğini alın.
- Supabase → Authentication → URL Configuration → **Site URL** şu an `http://localhost:3000`.
  Uygulama giriş için kod kullandığından şu an sorun çıkarmıyor; web sürümü yayınlanırsa onun adresine çekin.
- Tarama bilgisayarı doğruluğu: `npm run tarama:sentetik` ve `npm run tarama:test -- tarama-test/sentetik`
  ile sentetik sayfalarda ölçülür; sahte isimlerle elle yazılmış sayfalarla da ölçün.

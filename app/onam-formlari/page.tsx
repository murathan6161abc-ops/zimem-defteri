'use client';
import { RESEARCH_CONTACT } from '@/lib/research';

// Yazdırılabilir onam formları (şartname 4.2.8): katılımcı için gönüllü katılım formu,
// 18 yaş altı için veli onam formu. Taslaktır; danışman ve etik kurulla gözden geçirilmeli.
// Giriş gerektirmez: araştırmacı ya da veli doğrudan açıp yazdırabilir.

const LINE = '................................................................';

function Field({ label }: { label: string }) {
  return (
    <p className="form-field">
      {label}: <span className="form-line">{LINE}</span>
    </p>
  );
}

function StudyInfo() {
  return (
    <>
      <h3>Araştırma hakkında</h3>
      <p>
        <strong>Araştırmanın adı:</strong> <span className="form-line">{LINE}</span>
      </p>
      <p>
        <strong>Amaç:</strong> Bir iyilik davranışının (uygulamada bir borcu kapatma) kişinin duygu durumuna etkisini
        bilimsel ölçeklerle (PANAS kısa formu, WHO-5 İyilik Hali İndeksi) incelemek.
      </p>
      <p>
        <strong>Ne yapılacak:</strong> Katılımcı “Dijital Zimem Defteri” uygulamasında takma adla bir hesap açar, bir borç
        seçmeden önce ve sonra kısa anketleri yanıtlar. Bir uygulama oturumu yaklaşık 5 dakika sürer.{' '}
        <strong>Gerçek para harcanmaz;</strong> uygulamadaki ödeme bir simülasyondur.
      </p>
      <p>
        <strong>Gizlilik:</strong> Gerçek ad, telefon ya da kimlik bilgisi uygulamaya girilmez. Yanıtlar hesaba bağlı
        rastgele bir kimlikle saklanır ve yalnızca toplu, anonim olarak raporlanır. Bu kâğıt form uygulamadaki
        verilerden ayrı saklanır.
      </p>
      <p>
        <strong>Riskler ve yararlar:</strong> Sorular yalnızca duygu durumunu sorar; bilinen bir risk yoktur. Katılımcı
        istemediği soruyu atlayabilir. Doğrudan bir kazanç yoktur.
      </p>
      <p>
        <strong>Gönüllülük ve çekilme:</strong> Katılım gönüllüdür. Katılımcı istediği an gerekçe göstermeden çekilebilir
        ve uygulamadaki Profil sayfasından “Hesabımı ve verilerimi sil” ile tüm verisini kalıcı olarak silebilir.
      </p>
      <Field label="Araştırmacı öğrenci(ler)" />
      <Field label="Danışman öğretmen" />
      <Field label="Okul" />
      <p>
        <strong>İletişim:</strong>{' '}
        {RESEARCH_CONTACT || <span className="form-line">{LINE}</span>}
      </p>
    </>
  );
}

export default function ConsentFormsPage() {
  return (
    <div className="consent-forms max-w-3xl mx-auto py-6">
      <div className="no-print glass p-4 mb-6 text-sm space-y-2">
        <p>
          Bu sayfadaki iki form yazdırılıp imzalatılır ve araştırma ekibinde saklanır. Metinler <strong>taslaktır</strong>;
          danışman öğretmen ve etik kurulun önerileriyle düzenlenmelidir.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Yazdır
        </button>
      </div>

      <section className="form-page">
        <h2>Veli Onam Formu (18 yaş altı katılımcılar için)</h2>
        <StudyInfo />
        <h3>Onay</h3>
        <p>
          Yukarıdaki bilgileri okudum ve anladım. Velisi/yasal temsilcisi olduğum öğrencinin bu araştırmaya gönüllü
          olarak katılmasına izin veriyorum. Bu izni istediğim zaman geri çekebileceğimi biliyorum.
        </p>
        <Field label="Öğrencinin adı soyadı" />
        <Field label="Velinin adı soyadı" />
        <Field label="Yakınlık derecesi" />
        <Field label="Tarih" />
        <Field label="İmza" />
      </section>

      <section className="form-page">
        <h2>Gönüllü Katılım Formu</h2>
        <StudyInfo />
        <h3>Onay</h3>
        <p>
          Yukarıdaki bilgileri okudum ve anladım. Bu araştırmaya gönüllü olarak katılıyorum. İstediğim zaman gerekçe
          göstermeden çekilebileceğimi ve verilerimi silebileceğimi biliyorum.
        </p>
        <Field label="Katılımcının adı soyadı" />
        <Field label="Yaş grubu (18 altı / 18 ve üstü)" />
        <Field label="Tarih" />
        <Field label="İmza" />
      </section>
    </div>
  );
}

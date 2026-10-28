'use client';
import { useState } from 'react';
import type { SubmissionRow } from '@/app/admin/page';
import type { Category } from '@/types';
import { DATA_DICTIONARY, anonymizedCsv, buildStatsMarkdown } from '@/lib/researchStats';

const CATEGORIES: Category[] = ['gida', 'egitim', 'fatura', 'saglik'];

function average(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => value !== null);
  if (measured.length === 0) return null;
  return measured.reduce((sum, value) => sum + value, 0) / measured.length;
}

function formatAverage(value: number | null): string {
  return value === null ? 'ölçüm yok' : value.toFixed(2);
}

function percent(part: number, total: number): string {
  return total === 0 ? '0.0' : ((part / total) * 100).toFixed(1);
}

function buildResearchReport(rows: SubmissionRow[]): string {
  const total = rows.length;
  const participants = new Set(rows.map((row) => row.user_id)).size;
  const totalAmount = rows.reduce((sum, row) => sum + row.debt_amount, 0);
  const repeatYes = rows.filter((row) => row.will_repeat === 'evet').length;
  const avgPreHuzur = average(rows.map((row) => row.pre_huzur));
  const avgPostHuzur = average(rows.map((row) => row.post_huzur));
  const avgPreLikert = average(rows.map((row) => row.pre_likert));
  const avgPostLikert = average(rows.map((row) => row.post_likert));
  const avgPanasNeg = average(rows.map((row) => row.panas_neg_total));
  const avgPanasPos = average(rows.map((row) => row.panas_pos_total));

  const categoryLines = CATEGORIES.map((category) => {
    const categoryRows = rows.filter((row) => row.debt_category === category);
    const categoryAmount = categoryRows.reduce((sum, row) => sum + row.debt_amount, 0);
    return `- ${category}: ${categoryRows.length} işlem (%${percent(categoryRows.length, total)}), ${categoryAmount} TL`;
  }).join('\n');

  // Huzur ön ve son testte aynı soruyla ölçülür. Likert maddeleri ise farklı sorulardır
  // (ön: dayanışmanın değeri, son: "iyilik şifadır" sözüne katılım); aralarında fark alınmaz.
  const pairedHuzur = rows.filter((row) => row.pre_huzur !== null && row.post_huzur !== null);
  const huzurChange =
    pairedHuzur.length > 0
      ? (
          pairedHuzur.reduce((sum, row) => sum + (row.post_huzur as number) - (row.pre_huzur as number), 0) /
          pairedHuzur.length
        ).toFixed(2)
      : 'hesaplanamadı';

  return `# D-Zimem Araştırma Özeti

Oluşturulma: ${new Date().toLocaleString('tr-TR')}

## Kapsam

- Gönderim: ${total}
- Katılımcı: ${participants}
- Toplam işlem tutarı: ${totalAmount} TL
- Yeniden iyilik yapma niyeti (evet): ${repeatYes} (%${percent(repeatYes, total)})

## Ön Test / Son Test

- Huzur (1-10) ortalaması: ön test ${formatAverage(avgPreHuzur)}, son test ${formatAverage(avgPostHuzur)}
- Huzur farkı (son - ön, ${pairedHuzur.length} eşleşmiş kayıt): ${huzurChange}
- Ön test "dayanışmanın değeri" maddesi (1-5): ${formatAverage(avgPreLikert)}
- Son test "iyilik şifadır" maddesi (1-5): ${formatAverage(avgPostLikert)}
- PANAS negatif ön test ortalaması: ${formatAverage(avgPanasNeg)}
- PANAS pozitif son test ortalaması: ${formatAverage(avgPanasPos)}

## Kategori Dağılımı

${categoryLines}

${buildStatsMarkdown(rows)}
## Yorumlama Notu

Kontrol grubu olmadan nedensellik iddia edilemez. Küçük örneklem, öz-seçim ve öz-bildirim yanlılığı raporlanmalıdır.
`;
}

export default function ResearchReportPanel({ rows, isCapacitor }: { rows: SubmissionRow[]; isCapacitor?: boolean }) {
  const [report, setReport] = useState<string | null>(null);

  function generate() {
    if (rows.length === 0) return;
    setReport(buildResearchReport(rows));
  }

  function saveFile(name: string, content: string, mime: string) {
    // Capacitor/APK'da <a download> güvenilir çalışmıyor; orada panoya kopyalanır.
    if (isCapacitor) {
      void navigator.clipboard.writeText(content).then(() => alert(`${name} panoya kopyalandı.`));
      return;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const today = new Date().toISOString().slice(0, 10);

  function download() {
    if (!report) return;
    saveFile(`zimem-arastirma-ozeti-${today}.md`, report, 'text/markdown;charset=utf-8');
  }

  return (
    <section className="mt-8">
      <h2 className="heading-lg mb-3">Araştırma Özeti</h2>
      <div className="glass-strong p-5">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-primary"
            onClick={generate}
            disabled={rows.length === 0}
          >
            Özeti oluştur
          </button>
          {/* Capacitor/APK'da blob + <a download> güvenilir çalışmıyor; orada
              yalnızca "Kopyala" (panoya) sunuluyor. */}
          {report && !isCapacitor && (
            <button type="button" className="btn" onClick={download}>
              Markdown indir
            </button>
          )}
          {report && (
            <button type="button" className="btn" onClick={() => navigator.clipboard.writeText(report)}>
              Kopyala
            </button>
          )}
          <button
            type="button"
            className="btn"
            disabled={rows.length === 0}
            onClick={() => saveFile(`zimem-anonim-${today}.csv`, '\ufeff' + anonymizedCsv(rows), 'text/csv;charset=utf-8')}
          >
            Anonim CSV
          </button>
          <button type="button" className="btn" onClick={() => saveFile('zimem-veri-sozlugu.md', DATA_DICTIONARY, 'text/markdown;charset=utf-8')}>
            Veri sözlüğü
          </button>
        </div>
        <p className="text-xs text-muted-c mt-3">
          Anonim CSV takma ad, şehir, borç başlığı ve hesap kimliği içermez; rapor ekine ve JASP/SPSS analizine uygundur.
        </p>

        {report && (
          <div className="mt-5 glass p-5 max-h-[600px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
            {report}
          </div>
        )}
      </div>
    </section>
  );
}

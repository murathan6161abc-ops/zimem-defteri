'use client';
import { useEffect, useState } from 'react';
import ModalShell from './ModalShell';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { splitPanas } from '@/lib/scales';
import PanasSection from './PanasSection';
import type { PostTestData } from '@/types';

// value, puan hesabında kullanılan duygu ağırlığıdır (lib/xp.ts).
const EMOTIONS: { key: PostTestData['emotion']; value: number }[] = [
  { key: 'mutlu', value: 4 },
  { key: 'dingin', value: 4 },
  { key: 'hafiflemis', value: 4 },
  { key: 'gururlu', value: 3 },
];

const REPEAT: PostTestData['willRepeat'][] = ['evet', 'belki', 'bilmiyorum'];

// Ödeme bu adımdan önce kaydedildiği için pencere kapatılamaz; son test tamamlanınca
// puan ve geçmiş yazılır.
export default function PosttestModal({ open }: { open: boolean }) {
  const submit = useZimemStore((s) => s.submitPosttest);
  const remaining = useZimemStore((s) => s.payment?.remaining ?? 0);
  // Ön testte PANAS dolduran kişiye son testte aynı maddeler zorunlu sorulur; yoksa
  // ön ölçümün eşi olmaz ve karşılaştırma yapılamaz.
  const panasRequired = useZimemStore((s) => !!s.preData?.panasNeg);
  const { t } = useI18n();

  const [huzur, setHuzur] = useState<number | null>(null);
  const [emotion, setEmotion] = useState<PostTestData['emotion'] | null>(null);
  const [likert, setLikert] = useState<number>(0);
  const [willRepeat, setWillRepeat] = useState<PostTestData['willRepeat'] | null>(null);
  // PANAS (ön testteki aynı 10 madde)
  const [panasOpen, setPanasOpen] = useState(panasRequired);
  const [panas, setPanas] = useState<Record<string, number>>({});
  useEffect(() => {
    if (open && panasRequired) setPanasOpen(true);
  }, [open, panasRequired]);

  const panasScores = panasOpen ? splitPanas(panas) : null;
  const panasOK = !panasOpen || panasScores !== null;
  const canSubmit =
    huzur !== null && emotion !== null && likert > 0 && willRepeat !== null && panasOK;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const found = EMOTIONS.find((e) => e.key === emotion)!;
    submit({
      huzur: huzur!,
      emotion: emotion!,
      emotionValue: found.value,
      likert,
      willRepeat: willRepeat!,
      panasNeg: panasScores?.panasNeg,
      panasPos: panasScores?.panasPos,
    });
    setHuzur(null);
    setEmotion(null);
    setLikert(0);
    setWillRepeat(null);
    setPanas({});
    setPanasOpen(false);
  };

  return (
    <ModalShell
      open={open}
      title={t('posttest.title')}
      subtitle={remaining > 0 ? t('posttest.subtitle_partial') : t('posttest.subtitle_full')}
    >
      <div className="space-y-6">
        <section>
          <div className="text-sm mb-3">{t('posttest.q_huzur')}</div>
          <div className="scale-circles">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`scale-circle ${huzur === n ? 'selected' : ''}`}
                onClick={() => setHuzur(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-sm mb-3">{t('posttest.q1')}</div>
          <div className="emotion-grid">
            {EMOTIONS.map((e) => (
              <button
                key={e.key}
                type="button"
                className={`emotion-card ${emotion === e.key ? 'selected' : ''}`}
                onClick={() => setEmotion(e.key)}
              >
                <div className="emotion-label">{t(`posttest.emo_${e.key}`)}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-sm mb-3">{t('posttest.q2')}</div>
          <div className="likert-stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                className={`likert-star ${likert >= s ? 'active' : ''}`}
                onClick={() => setLikert(s)}
                aria-label={t('common.star_rating', { n: s })}
              >
                ★
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-sm mb-3">{t('posttest.q3')}</div>
          <div className="repeat-options">
            {REPEAT.map((r) => (
              <button
                key={r}
                type="button"
                className={`repeat-btn ${willRepeat === r ? 'selected' : ''}`}
                onClick={() => setWillRepeat(r)}
              >
                {t(`posttest.repeat_${r}`)}
              </button>
            ))}
          </div>
        </section>

        <PanasSection
          open={panasOpen}
          onToggle={() => setPanasOpen(!panasOpen)}
          answers={panas}
          onAnswer={(key, v) => setPanas((p) => ({ ...p, [key]: v }))}
          required={panasRequired}
        />

        <div className="pt-2">
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {t('posttest.see_result')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

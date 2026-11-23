'use client';
import { useState } from 'react';
import ModalShell from './ModalShell';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { splitPanas } from '@/lib/scales';
import PanasSection from './PanasSection';
import type { PreTestData } from '@/types';

// value, puan hesabında kullanılan duygu ağırlığıdır (lib/xp.ts).
const EMOTIONS: { key: PreTestData['emotion']; value: number }[] = [
  { key: 'merak', value: 2 },
  { key: 'sorumluluk', value: 4 },
  { key: 'huzur', value: 3 },
  { key: 'heyecan', value: 3 },
];

export default function PretestModal({ open }: { open: boolean }) {
  const closeModal = useZimemStore((s) => s.closeModal);
  const submit = useZimemStore((s) => s.submitPretest);
  const { t } = useI18n();

  const [huzur, setHuzur] = useState<number | null>(null);
  const [emotion, setEmotion] = useState<PreTestData['emotion'] | null>(null);
  const [likert, setLikert] = useState<number>(0);
  // PANAS (iki alt ölçek, 10 madde); bölüm isteğe bağlı
  const [panasOpen, setPanasOpen] = useState(false);
  const [panas, setPanas] = useState<Record<string, number>>({});

  // Bölüm açıldıysa on maddenin hepsi cevaplanmalı.
  const panasScores = panasOpen ? splitPanas(panas) : null;
  const panasOK = !panasOpen || panasScores !== null;
  const canSubmit = huzur !== null && emotion !== null && likert > 0 && panasOK;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const found = EMOTIONS.find((e) => e.key === emotion)!;
    submit({
      huzur: huzur!,
      emotion: emotion!,
      emotionValue: found.value,
      likert,
      panasNeg: panasScores?.panasNeg,
      panasPos: panasScores?.panasPos,
    });
    setHuzur(null);
    setEmotion(null);
    setLikert(0);
    setPanas({});
    setPanasOpen(false);
  };

  const handleClose = () => {
    setHuzur(null); setEmotion(null); setLikert(0); setPanas({}); setPanasOpen(false);
    closeModal();
  };

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={t('pretest.title')}
      subtitle={t('pretest.subtitle')}
    >
      <div className="space-y-6">
        <section>
          <div className="text-sm mb-3">{t('pretest.q1')}</div>
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
          <div className="text-sm mb-3">{t('pretest.q2')}</div>
          <div className="emotion-grid">
            {EMOTIONS.map((e) => (
              <button
                key={e.key}
                type="button"
                className={`emotion-card ${emotion === e.key ? 'selected' : ''}`}
                onClick={() => setEmotion(e.key)}
              >
                <div className="emotion-label">{t(`pretest.emo_${e.key}`)}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-sm mb-3">{t('pretest.q3')}</div>
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

        <PanasSection
          open={panasOpen}
          onToggle={() => setPanasOpen(!panasOpen)}
          answers={panas}
          onAnswer={(key, v) => setPanas((p) => ({ ...p, [key]: v }))}
        />

        <div className="flex gap-2 pt-2">
          <button type="button" className="btn flex-1" onClick={handleClose}>
            {t('common.give_up')}
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {t('common.continue_arrow')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

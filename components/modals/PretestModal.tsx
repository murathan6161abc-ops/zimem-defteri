'use client';
import { useState } from 'react';
import ModalShell from './ModalShell';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { PANAS_NEGATIVE } from '@/lib/scales';
import type { PreTestData } from '@/types';

const EMOTIONS: { key: PreTestData['emotion']; emoji: string; value: number }[] = [
  { key: 'merak', emoji: '🤔', value: 2 },
  { key: 'sorumluluk', emoji: '🛡️', value: 4 },
  { key: 'huzur', emoji: '🕊️', value: 3 },
  { key: 'heyecan', emoji: '✨', value: 3 },
];

export default function PretestModal({ open }: { open: boolean }) {
  const closeModal = useZimemStore((s) => s.closeModal);
  const submit = useZimemStore((s) => s.submitPretest);
  const { t } = useI18n();

  const [huzur, setHuzur] = useState<number | null>(null);
  const [emotion, setEmotion] = useState<PreTestData['emotion'] | null>(null);
  const [likert, setLikert] = useState<number>(0);
  // PANAS Negatif skorlar — opsiyonel (akademik araştırma için)
  const [panasOpen, setPanasOpen] = useState(false);
  const [panasNeg, setPanasNeg] = useState<Record<string, number>>({});

  // PANAS açıksa hepsi cevaplanmış olmalı; kapalıysa zorunlu değil
  const panasOK = !panasOpen || PANAS_NEGATIVE.every((it) => (panasNeg[it.key] || 0) > 0);
  const canSubmit = huzur !== null && emotion !== null && likert > 0 && panasOK;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const found = EMOTIONS.find((e) => e.key === emotion)!;
    submit({
      huzur: huzur!,
      emotion: emotion!,
      emotionValue: found.value,
      likert,
      panasNeg: panasOpen ? panasNeg : undefined,
    });
    setHuzur(null);
    setEmotion(null);
    setLikert(0);
    setPanasNeg({});
    setPanasOpen(false);
  };

  const handleClose = () => {
    setHuzur(null); setEmotion(null); setLikert(0); setPanasNeg({}); setPanasOpen(false);
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
                <div className="emotion-emoji">{e.emoji}</div>
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

        {/* PANAS — opsiyonel akademik ölçek */}
        <section className="border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setPanasOpen(!panasOpen)}
            className="w-full flex items-center justify-between text-left gap-2 group"
          >
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                🔬 {t('research.detail_toggle')} <span className="text-[11px] font-normal text-muted-c">{t('common.optional')}</span>
              </div>
              <div className="text-xs text-muted-c">
                {t('research.detail_sub')}
              </div>
            </div>
            <span className={`text-muted-c transition-transform ${panasOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {panasOpen && (
            <div className="mt-3">
              <div className="text-xs text-muted-c mb-3">{t('panas.instruction')}</div>
              <div className="space-y-2">
                {PANAS_NEGATIVE.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-white/90 min-w-[80px]">{t(item.i18nKey)}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setPanasNeg((p) => ({ ...p, [item.key]: v }))}
                          className={`w-7 h-7 rounded-full text-xs font-semibold transition-all ${
                            panasNeg[item.key] === v
                              ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black scale-110'
                              : 'bg-white/5 text-muted-c border border-white/10 hover:bg-white/10'
                          }`}
                          aria-label={`${item.key} ${v}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

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

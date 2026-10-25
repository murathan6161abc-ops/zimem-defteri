'use client';
import { useState } from 'react';
import ModalShell from './ModalShell';
import { useZimemStore } from '@/store/useZimemStore';
import { useI18n } from '@/lib/i18n';
import { PANAS_POSITIVE } from '@/lib/scales';
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
  const { t } = useI18n();

  const [huzur, setHuzur] = useState<number | null>(null);
  const [emotion, setEmotion] = useState<PostTestData['emotion'] | null>(null);
  const [likert, setLikert] = useState<number>(0);
  const [willRepeat, setWillRepeat] = useState<PostTestData['willRepeat'] | null>(null);
  // PANAS pozitif afekt maddeleri; bölüm isteğe bağlı
  const [panasOpen, setPanasOpen] = useState(false);
  const [panasPos, setPanasPos] = useState<Record<string, number>>({});

  const panasOK = !panasOpen || PANAS_POSITIVE.every((it) => (panasPos[it.key] || 0) > 0);
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
      panasPos: panasOpen ? panasPos : undefined,
    });
    setHuzur(null);
    setEmotion(null);
    setLikert(0);
    setWillRepeat(null);
    setPanasPos({});
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

        <section className="border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setPanasOpen(!panasOpen)}
            className="w-full flex items-center justify-between text-left gap-2"
          >
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                {t('research.detail_toggle')} <span className="text-[10px] font-normal text-muted-c">{t('common.optional')}</span>
              </div>
              <div className="text-[11px] text-muted-c">
                {t('research.detail_sub')}
              </div>
            </div>
            <span className={`text-muted-c transition-transform ${panasOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {panasOpen && (
            <div className="mt-3">
              <div className="text-[11px] text-muted-c mb-3">{t('panas.instruction')}</div>
              <div className="space-y-2">
                {PANAS_POSITIVE.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-white/90 min-w-[80px]">{t(item.i18nKey)}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setPanasPos((p) => ({ ...p, [item.key]: v }))}
                          className={`w-7 h-7 rounded-full text-[11px] font-semibold transition-all ${
                            panasPos[item.key] === v
                              ? 'bg-emerald-400 text-black'
                              : 'bg-white/5 text-muted-c border border-white/10 hover:bg-white/10'
                          }`}
                          aria-label={`${t(item.i18nKey)} ${v}`}
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

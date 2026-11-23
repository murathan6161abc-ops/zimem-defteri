'use client';
// Ön ve son testte aynı PANAS bölümü: iki alt ölçeğin 10 maddesi, aynı sırayla.
// Ön-son karşılaştırması ancak iki ölçümde aynı maddeler sorulursa yapılabilir.
import { useI18n } from '@/lib/i18n';
import { PANAS_DISPLAY_ORDER } from '@/lib/scales';

export default function PanasSection({
  open,
  onToggle,
  answers,
  onAnswer,
  required = false,
}: {
  open: boolean;
  onToggle: () => void;
  answers: Record<string, number>;
  onAnswer: (key: string, value: number) => void;
  // Ön testte doldurulduysa son testte de zorunlu: bölüm kapatılamaz.
  required?: boolean;
}) {
  const { t } = useI18n();

  return (
    <section className="border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={required ? undefined : onToggle}
        aria-expanded={open}
        aria-disabled={required || undefined}
        className="w-full flex items-center justify-between text-left gap-2"
      >
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            🔬 {t('research.detail_toggle')}{' '}
            {!required && <span className="text-[11px] font-normal text-muted-c">{t('common.optional')}</span>}
          </div>
          <div className="text-xs text-muted-c">
            {t(required ? 'research.detail_required' : 'research.detail_sub')}
          </div>
        </div>
        {!required && <span className={`text-muted-c transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>}
      </button>

      {open && (
        <div className="mt-3">
          <div className="text-xs text-muted-c mb-3">{t('panas.instruction')}</div>
          <div className="space-y-2">
            {PANAS_DISPLAY_ORDER.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-white/90 min-w-[80px]">{t(item.i18nKey)}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onAnswer(item.key, v)}
                      aria-pressed={answers[item.key] === v}
                      className={`w-7 h-7 rounded-full text-xs font-semibold transition-all ${
                        answers[item.key] === v
                          ? 'bg-amber-400 text-black'
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
  );
}

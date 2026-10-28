// ============================================================
// Defter tarama oturumu — sayfadan bağımsız
// ────────────────────────────────────────────────────────────
// Tarama sayfasından çıkılsa da okuma sürer: kuyruktaki işler burada takip
// edilir, sonuçlar inceleme listesine eklenir ve esnaf başka bir sayfadaysa
// bildirim gösterilir. İşler ve inceleme listesi cihazda saklanır; uygulama
// kapanıp açılınca takip kaldığı yerden devam eder (fotoğraflar yalnızca
// bellekte tutulur). Hesaptan çıkınca oturum silinir (clearLedgerRefs).
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentUserId } from '@/lib/auth';
import { tStatic } from '@/lib/i18n';
import {
  readLedgerRefs,
  scanErrorKey,
  SCAN_RESET_EVENT,
  SCAN_SESSION_KEY,
  submitScan,
  waitForScan,
  type ScanErrorCode,
  type ScannedEntry,
  type ScanStage,
} from '@/lib/ledgerScan';
import { useZimemStore } from './useZimemStore';

export interface ReviewRow extends ScannedEntry {
  key: string;
  selected: boolean;
  duplicate: boolean;
  urgency: 1 | 2 | 3;
  description: string;
  amountText: string;
  page: number; // kaçıncı taranan sayfa (fotoğrafı görmek için)
}

export interface ScanJob {
  localId: string;
  jobId: string | null; // sunucuya yazılınca dolar
  page: number;
  stage: ScanStage;
  createdAt: number;
}

interface ScanState {
  ownerId: string;
  jobs: ScanJob[];
  rows: ReviewRow[];
  warning: string;
  pageCount: number;
  photos: Record<number, string>; // blob adresleri — kalıcı değil
  lastError: ScanErrorCode | null;
  ensureOwner: () => void;
  startScan: (base64: string, photo: string) => void;
  resume: () => void;
  updateRow: (key: string, patch: Partial<ReviewRow>) => void;
  removeRow: (key: string) => void;
  clearReview: () => void;
  clearError: () => void;
}

// Aynı iş için iki bekleme döngüsü açılmasın (sayfa + uygulama açılışı).
const polling = new Set<string>();
// Uygulama açılışında kalan işler bir kez devam ettirilir.
let resumed = false;

/** "1.250,50" → 1251 */
export function parseAmountText(text: string): number {
  const n = Math.round(Number(text.replace(/\./g, '').replace(',', '.')));
  return Number.isFinite(n) ? n : 0;
}

function onScanPage(): boolean {
  return typeof window !== 'undefined' && /\/esnaf\/tara\/?$/.test(window.location.pathname);
}

function notify(_emoji: string, title: string, desc?: string) {
  useZimemStore.getState().pushToast({ title, desc });
}

const EMPTY = {
  jobs: [] as ScanJob[],
  rows: [] as ReviewRow[],
  warning: '',
  pageCount: 0,
  photos: {} as Record<number, string>,
  lastError: null as ScanErrorCode | null,
};

export const useScanStore = create<ScanState>()(
  persist(
    (set, get) => {
      const revokePhotos = () => {
        for (const url of Object.values(get().photos)) URL.revokeObjectURL(url);
      };

      const patchJob = (localId: string, patch: Partial<ScanJob>) =>
        set((s) => ({ jobs: s.jobs.map((j) => (j.localId === localId ? { ...j, ...patch } : j)) }));

      const dropJob = (localId: string) => set((s) => ({ jobs: s.jobs.filter((j) => j.localId !== localId) }));

      /** Kuyruktaki işi sonuna kadar bekler; sonucu inceleme listesine ekler. */
      const follow = async (job: ScanJob, owner: string) => {
        if (!job.jobId || polling.has(job.jobId)) return;
        polling.add(job.jobId);
        try {
          const res = await waitForScan(job.jobId, {
            createdAt: job.createdAt,
            onStage: (stage) => get().ownerId === owner && patchJob(job.localId, { stage }),
            shouldStop: () => get().ownerId !== owner,
          });
          if (!res || get().ownerId !== owner) return;
          dropJob(job.localId);
          if (!res.ok) {
            set({ lastError: res.error });
            if (!onScanPage()) notify('⚠️', tStatic('scan.bg_failed_title'), tStatic(scanErrorKey(res.error)));
            return;
          }
          mergeResult(job, res.entries, res.warningCode === 'not_ledger' ? tStatic('scan.warn_not_ledger') : res.warning);
          if (!onScanPage()) {
            notify('📖', tStatic('scan.bg_done_title'), tStatic('scan.bg_done_desc', { count: res.entries.length }));
          }
        } finally {
          polling.delete(job.jobId);
        }
      };

      /** Okunan kayıtları listeye ekler; defterde zaten olanları ve şüphelileri seçmez. */
      const mergeResult = (job: ScanJob, entries: ScannedEntry[], warning: string) => {
        const refs = readLedgerRefs();
        const known = new Set<string>();
        for (const d of useZimemStore.getState().merchantDebts) {
          if (!d.closed && refs[d.id]) known.add(`${refs[d.id]}|${d.amount}`);
        }
        set((s) => {
          const seen = new Set([...known, ...s.rows.map((r) => `${r.ref}|${parseAmountText(r.amountText)}`)]);
          const added: ReviewRow[] = entries.map((e, i) => {
            const dupKey = `${e.ref}|${e.amount}`;
            const duplicate = !!e.ref && seen.has(dupKey);
            seen.add(dupKey);
            return {
              ...e,
              key: `${job.localId}-${i}`,
              // Şüpheli kayıt (tutmayan toplam / net okunamayan / kapanmış olabilir) kendiliğinden seçilmez.
              selected: !e.paid && !duplicate && !e.issue,
              duplicate,
              urgency: 2,
              description: e.items,
              amountText: String(e.amount),
              page: job.page,
            };
          });
          // Borç çıkmayan sayfa sessizce kaybolmasın: esnafa söylenir.
          const notice = warning || (entries.length === 0 ? tStatic('scan.none_found') : '');
          return { rows: [...s.rows, ...added], warning: notice || s.warning };
        });
      };

      return {
        ownerId: '',
        ...EMPTY,

        ensureOwner: () => {
          const uid = getCurrentUserId();
          if (get().ownerId === uid) return;
          revokePhotos();
          set({ ownerId: uid, ...EMPTY });
        },

        startScan: (base64, photo) => {
          get().ensureOwner();
          const owner = get().ownerId;
          const page = get().pageCount + 1;
          const localId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const job: ScanJob = { localId, jobId: null, page, stage: 'uploading', createdAt: Date.now() };
          set((s) => ({
            jobs: [...s.jobs, job],
            pageCount: page,
            photos: { ...s.photos, [page]: photo },
            lastError: null,
            warning: '',
          }));
          void (async () => {
            const sent = await submitScan(base64);
            if (get().ownerId !== owner) return;
            if (!sent.ok) {
              dropJob(localId);
              set({ lastError: sent.error });
              if (!onScanPage()) notify('⚠️', tStatic('scan.bg_failed_title'), tStatic(scanErrorKey(sent.error)));
              return;
            }
            const queued = { ...job, jobId: sent.jobId, createdAt: sent.createdAt, stage: 'queued' as const };
            patchJob(localId, queued);
            await follow(queued, owner);
          })();
        },

        resume: () => {
          get().ensureOwner();
          if (resumed) return;
          resumed = true;
          const owner = get().ownerId;
          // Gönderilemeden kapanmış işler (jobId yok) kurtarılamaz; listeden düşer.
          set((s) => ({ jobs: s.jobs.filter((j) => j.jobId) }));
          for (const job of get().jobs) void follow(job, owner);
        },

        updateRow: (key, patch) => set((s) => ({ rows: s.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) })),
        removeRow: (key) => set((s) => ({ rows: s.rows.filter((r) => r.key !== key) })),
        clearReview: () => {
          // Süren işlerin fotoğrafları kalsın; yalnızca incelenmiş sayfalarınki silinsin.
          const active = new Set(get().jobs.map((j) => j.page));
          const photos: Record<number, string> = {};
          for (const [page, url] of Object.entries(get().photos)) {
            if (active.has(Number(page))) photos[Number(page)] = url;
            else URL.revokeObjectURL(url);
          }
          set({ rows: [], warning: '', photos });
        },
        clearError: () => set({ lastError: null }),
      };
    },
    {
      name: SCAN_SESSION_KEY,
      partialize: (s) => ({
        ownerId: s.ownerId,
        jobs: s.jobs,
        rows: s.rows,
        warning: s.warning,
        pageCount: s.pageCount,
      }),
    },
  ),
);

// Hesaptan çıkınca (clearLedgerRefs) bellekteki oturum da sıfırlansın.
if (typeof window !== 'undefined') {
  window.addEventListener(SCAN_RESET_EVENT, () => {
    const s = useScanStore.getState();
    for (const url of Object.values(s.photos)) URL.revokeObjectURL(url);
    resumed = false;
    useScanStore.setState({ ownerId: '', ...EMPTY });
  });
}

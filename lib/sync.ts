import { getSupabase } from './supabase';
import { getCurrentUserId } from './auth';
import { panasTotal } from './scales';
import { APP_VERSION } from './version';
import { surveyAppVersion } from './research';
import type {
  Debt,
  HistoryEntry,
  PreTestData,
  PostTestData,
  UserProfile,
  MerchantDebt,
} from '@/types';

/**
 * Ön test + son test cevaplarını kaydeder. Ödeme bundan önce, onay adımında
 * pay_merchant_debt ile yapılmıştır; entry.amount sunucunun düştüğü tutardır.
 */
export async function syncSurveySubmission(args: {
  debt: Debt | MerchantDebt;
  pre: PreTestData;
  post: PostTestData;
  entry: HistoryEntry;
  profile: UserProfile | null;
}): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { debt, pre, post, entry, profile } = args;

  const row = {
    user_id: getCurrentUserId(),
    display_name: profile?.displayName || null,
    city: profile?.city || null,
    debt_id: debt.id,
    debt_title: debt.title,
    debt_category: debt.category,
    debt_amount: entry.amount,
    debt_urgency: debt.urgency,
    debt_added_by: 'addedBy' in debt ? debt.addedBy : null,
    pre_huzur: pre.huzur,
    pre_emotion: pre.emotion,
    pre_emotion_value: pre.emotionValue,
    pre_likert: pre.likert,
    post_huzur: post.huzur,
    post_emotion: post.emotion,
    post_emotion_value: post.emotionValue,
    post_likert: post.likert,
    will_repeat: post.willRepeat,
    xp_gained: entry.xp,
    app_version: surveyAppVersion(APP_VERSION),
    age_group: profile?.ageGroup ?? null,
    // PANAS: ön test negatif + son test pozitif (ilk sürümden beri olan sütunlar)
    panas_neg_scores: pre.panasNeg || null,
    panas_pos_scores: post.panasPos || null,
    panas_neg_total: panasTotal(pre.panasNeg),
    panas_pos_total: panasTotal(post.panasPos),
  };
  // Ön test pozitif + son test negatif (20261123120000_panas_both_timepoints.sql)
  const bothTimepoints = {
    pre_panas_pos_scores: pre.panasPos || null,
    pre_panas_pos_total: panasTotal(pre.panasPos),
    post_panas_neg_scores: post.panasNeg || null,
    post_panas_neg_total: panasTotal(post.panasNeg),
  };

  // insert() hata fırlatmaz, { error } döndürür; kontrol edilmezse şema uyumsuzluğu
  // araştırma verisini sessizce kaybettirir.
  try {
    let { error } = await client.from('survey_submissions').insert({ ...row, ...bothTimepoints });
    if (isMissingPanasColumnError(error)) {
      // Göç henüz çalıştırılmamış: gönderimin geri kalanı kaybolmasın.
      console.warn('[sync] PANAS ön-son sütunları yok; göç çalıştırılmalı:', error?.message);
      ({ error } = await client.from('survey_submissions').insert(row));
    }
    if (error) {
      console.warn('[sync] survey_submissions yazılamadı:', error.message);
    }
  } catch (e) {
    console.warn('[sync] survey_submissions istisna:', e);
  }
}

/** Yeni PANAS sütunları veritabanında henüz yok mu? */
export function isMissingPanasColumnError(
  error: { code?: string; message?: string; details?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  const text = `${error.message ?? ''} ${error.details ?? ''}`;
  return /column/i.test(text) && /(pre_panas_pos|post_panas_neg)/.test(text);
}

/**
 * Kullanıcı özet snapshot'ını (XP, debtsPaid, streak) Supabase'e yazar.
 * Liderlik tablosu bu satırlardan beslenir.
 */
export async function syncDeviceSnapshot(args: {
  profile: UserProfile | null;
  xp: number;
  debtsPaid: number;
  totalDonated: number;
  streak: number;
}): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  try {
    const { error } = await client.from('device_snapshots').upsert(
      {
        user_id: getCurrentUserId(),
        display_name: args.profile?.displayName || null,
        role: args.profile?.role || null,
        city: args.profile?.city || null,
        total_xp: args.xp,
        debts_paid: args.debtsPaid,
        total_donated: args.totalDonated,
        streak: args.streak,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      console.warn('[sync] device_snapshots yazılamadı:', error.message);
    }
  } catch (e) {
    console.warn('[sync] device_snapshots istisna:', e);
  }
}

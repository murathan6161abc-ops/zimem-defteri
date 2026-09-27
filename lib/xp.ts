import type { Debt, PreTestData, PostTestData } from '@/types';

// IP = (D × 1.5) + (B × 1.2) + (A × 2.0)
// D = (D_pre + D_post + likertPre/2.5 + likertPost/2.5) / 2
// B = payAmount / 100   (ödenen tutar — kısmi ödemede küçülür)
// A = urgency × (payAmount / debt.amount)   (aciliyet de ödenen orana göre)
// Bonus: willRepeat 'evet' ×1.3, 'belki' ×1.1
export function calculateXP(
  pre: PreTestData,
  post: PostTestData,
  debt: Debt,
  payAmount?: number,
): number {
  const D_pre = pre.emotionValue || 1;
  const D_post = post.emotionValue || 1;
  const likertPre = pre.likert || 3;
  const likertPost = post.likert || 3;

  const D = (D_pre + D_post + likertPre / 2.5 + likertPost / 2.5) / 2;

  // Kısmi ödeme: payAmount belirtilmemişse tam ödeme varsayılır
  const actualPay =
    payAmount && payAmount > 0 ? Math.min(payAmount, debt.amount) : debt.amount;
  const ratio = actualPay / Math.max(1, debt.amount);

  const B = actualPay / 100;
  const A = debt.urgency * ratio;

  const rawXP = D * 1.5 + B * 1.2 + A * 2.0;

  let bonus = 1.0;
  if (post.willRepeat === 'evet') bonus = 1.3;
  else if (post.willRepeat === 'belki') bonus = 1.1;

  return Math.round(rawXP * bonus);
}

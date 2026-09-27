'use client';
import { useZimemStore } from '@/store/useZimemStore';
import PretestModal from './PretestModal';
import PaymentModal from './PaymentModal';
import PosttestModal from './PosttestModal';
import ResultModal from './ResultModal';

export default function ModalFlow() {
  const step = useZimemStore((s) => s.modalStep);
  return (
    <>
      <PretestModal open={step === 'pretest'} />
      <PaymentModal open={step === 'payment'} />
      <PosttestModal open={step === 'posttest'} />
      <ResultModal open={step === 'result'} />
    </>
  );
}

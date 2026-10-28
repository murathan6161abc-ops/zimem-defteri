import ScoreBoard from '@/components/layout/ScoreBoard';
import DebtList from '@/components/debts/DebtList';
import ModalFlow from '@/components/modals/ModalFlow';

export default function HomePage() {
  return (
    <div className="pt-6">
      <ScoreBoard withStats />
      <DebtList />
      <ModalFlow />
    </div>
  );
}

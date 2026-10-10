import { MemberWellbeing } from '@/components/wellbeing/member-wellbeing';
import { PageTitle } from '@/components/wellbeing/parts';

export default function WellbeingPage() {
  return (
    <div className="space-y-6">
      <PageTitle>Wellbeing</PageTitle>
      <MemberWellbeing />
    </div>
  );
}

import { AdminChallengeDetail } from '@/components/wellbeing/admin-challenge-detail';

export default function AdminGroupChallengePage({ params }: { params: { id: string; challengeId: string } }) {
  return <AdminChallengeDetail groupId={params.id} challengeId={params.challengeId} />;
}

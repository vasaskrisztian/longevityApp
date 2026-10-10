'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteAdminGroupChallenge, getAdminGroupChallenge } from '@/lib/wellbeing/groups-api';
import { daysLeftLabel, displayName, formatDateRange, teamStatusLine } from '@/lib/wellbeing/format';
import { LoadingLine, PageTitle, ProgressBar, ProgressLine, StatusBadge } from './parts';
import { useLoad } from './use-load';

/** Corporate wellbeing — admin: where everyone stands in one group challenge, and the team as a whole. */
export function AdminChallengeDetail({ groupId, challengeId }: { groupId: string; challengeId: string }) {
  const router = useRouter();
  const { data, error } = useLoad(() => getAdminGroupChallenge(groupId, challengeId), [groupId, challengeId]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (error) return <Alert variant="destructive">{error}</Alert>;
  if (!data) return <LoadingLine />;
  const { challenge, team, participants, notJoined } = data;
  const left = daysLeftLabel(challenge.daysRemaining);

  async function remove() {
    if (!window.confirm(`Delete "${challenge.name}"? The challenge and everyone's progress in it are removed. No result notification will be sent.`)) return;
    setDeleting(true);
    try {
      await deleteAdminGroupChallenge(groupId, challengeId);
      router.push(`/admin/groups/${groupId}`);
    } catch {
      setActionError('Could not delete the challenge.');
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href={`/admin/groups/${groupId}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to the group
      </Link>
      {actionError && <Alert variant="destructive">{actionError}</Alert>}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <PageTitle>{challenge.name}</PageTitle>
          <StatusBadge status={challenge.status} />
        </div>
        <p className="text-sm">{challenge.target}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateRange(challenge.startDate, challenge.endDate)}
          {left ? ` · ${left}` : ''}
        </p>
        {challenge.description && <p className="text-sm">{challenge.description}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProgressBar percent={team.averagePercent} />
          <p className="text-sm">{teamStatusLine(team)}</p>
          <p className="text-xs text-muted-foreground">
            {team.participants} of {team.members} group members joined
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants ({participants.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {participants.length === 0 && <p className="text-sm text-muted-foreground">Nobody has joined yet.</p>}
          {participants.map((participant) => (
            <Link
              key={participant.userId}
              href={`/admin/groups/${groupId}/members/${participant.userId}`}
              className="block space-y-1.5 border-t border-card-border pt-3 first:border-t-0 first:pt-0"
            >
              <p className="font-medium">{displayName(participant)}</p>
              <ProgressLine progress={participant.progress} />
            </Link>
          ))}
        </CardContent>
      </Card>

      {notJoined.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Not joined ({notJoined.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {notJoined.map((member) => (
              <p key={member.userId} className="text-sm">
                {displayName(member)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Button variant="destructive" disabled={deleting} onClick={remove}>
        Delete this challenge
      </Button>
    </div>
  );
}

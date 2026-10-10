'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  acceptInvitationById,
  getMyWellbeing,
  joinGroupChallenge,
  leaveGroup,
  leaveGroupChallenge,
  listMyGroupChallenges,
  type MyGroup,
  type MyGroupChallenge,
  type PendingInvitation,
} from '@/lib/wellbeing/groups-api';
import { daysLeftLabel, formatDateRange, formatDay, teamStatusLine } from '@/lib/wellbeing/format';
import { TeamChart } from './team-chart';
import { CollectiveBar, ContributionLine, GroupLogo, LoadingLine, ProgressLine, StatusBadge } from './parts';
import { useLoad } from './use-load';

export function ConsentCheckbox({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm">
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function InvitationCard({ invitation, onAccepted }: { invitation: PendingInvitation; onAccepted: () => void }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptInvitationById(invitation.id);
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <GroupLogo logoUrl={invitation.logoUrl} />
          <div>
            <p className="font-display text-lg font-semibold text-primary">{invitation.groupName}</p>
            <p className="text-xs text-muted-foreground">Invitation · valid until {formatDay(invitation.expiresAt.slice(0, 10))}</p>
          </div>
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        <ConsentCheckbox id={`consent-${invitation.id}`} checked={consent} onChange={setConsent}>
          I agree that the administrators of {invitation.groupName} can see my health data (sleep, activity and other measurements). I can leave the
          group at any time.
        </ConsentCheckbox>
        <Button onClick={accept} disabled={!consent || busy}>
          {busy ? 'Joining…' : 'Accept and join'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ChallengeCard({ challenge, groupId, onChanged }: { challenge: MyGroupChallenge; groupId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = daysLeftLabel(challenge.daysRemaining);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (challenge.joined) await leaveGroupChallenge(groupId, challenge.id);
      else await joinGroupChallenge(groupId, challenge.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-card-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{challenge.name}</p>
        <StatusBadge status={challenge.status} />
      </div>
      <p className="text-sm">{challenge.target}</p>
      <p className="text-xs text-muted-foreground">
        {formatDateRange(challenge.startDate, challenge.endDate)}
        {left ? ` · ${left}` : ''}
      </p>
      {challenge.description && <p className="text-sm">{challenge.description}</p>}
      {challenge.collective ? (
        <>
          <CollectiveBar type={challenge.type} collective={challenge.collective} />
          {challenge.series && <TeamChart type={challenge.type} series={challenge.series} />}
          {challenge.joined && challenge.me && <ContributionLine label="Your share" type={challenge.type} progress={challenge.me} />}
          <p className="text-xs text-muted-foreground">
            {challenge.team.participants} of {challenge.team.members} members are adding to the total
          </p>
        </>
      ) : (
        <>
          {challenge.joined && challenge.me && <ProgressLine label="You" progress={challenge.me} />}
          <p className="text-xs text-muted-foreground">Team: {teamStatusLine(challenge.team)}</p>
        </>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
      {challenge.status !== 'ENDED' ? (
        <Button size="sm" variant={challenge.joined ? 'outline' : 'primary'} disabled={busy} onClick={toggle}>
          {challenge.joined ? 'Leave this challenge' : 'Join this challenge'}
        </Button>
      ) : (
        !challenge.joined && <p className="text-xs text-muted-foreground">You did not take part in this challenge.</p>
      )}
    </div>
  );
}

function GroupSection({ group, onLeft }: { group: MyGroup; onLeft: () => void }) {
  const { data: challenges, error: loadError, reload } = useLoad(() => listMyGroupChallenges(group.id), [group.id]);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function handleLeave() {
    if (
      !window.confirm(
        `Leave ${group.name}? The group's administrators will no longer be able to see your health data, and you will be removed from its challenges.`,
      )
    )
      return;
    setLeaving(true);
    try {
      await leaveGroup(group.id);
      onLeft();
    } catch {
      setLeaveError('Could not leave the group. Please try again.');
      setLeaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <GroupLogo logoUrl={group.logoUrl} />
          <div>
            <p className="font-display text-lg font-semibold text-primary">{group.name}</p>
            <p className="text-xs text-muted-foreground">
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'} · joined {formatDay(group.joinedAt.slice(0, 10))}
            </p>
          </div>
        </div>
        {(loadError || leaveError) && <Alert variant="destructive">{leaveError ?? 'Could not load the challenges.'}</Alert>}
        {!challenges && !loadError && <LoadingLine />}
        {challenges && challenges.length === 0 && (
          <p className="text-sm text-muted-foreground">No challenges yet. When an administrator creates one you will get a notification.</p>
        )}
        {challenges?.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} groupId={group.id} onChanged={reload} />
        ))}
        <Button size="sm" variant="ghost" disabled={leaving} onClick={handleLeave}>
          Leave this group
        </Button>
      </CardContent>
    </Card>
  );
}

/** Member side of corporate wellbeing: invitations, groups, challenges (own + team progress only). */
export function MemberWellbeing() {
  const { data, error, reload } = useLoad(getMyWellbeing, []);

  if (error) return <Alert variant="destructive">Could not load your groups. Please try again.</Alert>;
  if (!data) return <LoadingLine />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Groups you belong to through your company or team. Joining a group lets its administrators see your health data; challenges are always optional.
      </p>
      {data.pendingInvitations.map((invitation) => (
        <InvitationCard key={invitation.id} invitation={invitation} onAccepted={reload} />
      ))}
      {data.groups.map((group) => (
        <GroupSection key={group.id} group={group} onLeft={reload} />
      ))}
      {data.groups.length === 0 && data.pendingInvitations.length === 0 && (
        <p className="text-sm text-muted-foreground">You are not in any group yet. When someone invites you, the invitation shows up here and in your notifications.</p>
      )}
    </div>
  );
}

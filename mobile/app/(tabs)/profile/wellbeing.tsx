import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

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
} from '@/src/api/groups';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Checkbox } from '@/src/components/ui/Checkbox';
import { TeamChart } from '@/src/components/wellbeing/TeamChart';
import { CollectiveBar, ContributionLine, GroupLogo, ProgressLine, StatusBadge } from '@/src/components/wellbeing/parts';
import { colors, fontFamily } from '@/src/theme/tokens';
import { confirmDestructive } from '@/src/utils/confirm';
import { daysLeftLabel, formatDateRange, formatDay, teamStatusLine } from '@/src/wellbeing/format';

/**
 * Member side of corporate wellbeing: invitations waiting to be accepted
 * (with the explicit health-data consent), the groups the person belongs to,
 * and each group's challenges — join voluntarily, see your own progress and
 * the team's aggregate (never other people's data). Leaving a group ends the
 * administrators' access immediately.
 */

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
    <Card style={styles.card}>
      <View style={styles.groupHeader}>
        <GroupLogo logoUrl={invitation.logoUrl} />
        <View style={styles.flex}>
          <Text style={styles.groupName}>{invitation.groupName}</Text>
          <Text style={styles.muted}>Invitation · valid until {formatDay(invitation.expiresAt.slice(0, 10))}</Text>
        </View>
      </View>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Checkbox
        label={`I agree that the administrators of ${invitation.groupName} can see my health data (sleep, activity and other measurements). I can leave the group at any time.`}
        checked={consent}
        onChange={setConsent}
      />
      <Button title="Accept and join" onPress={accept} disabled={!consent} loading={busy} />
    </Card>
  );
}

function ChallengeCard({
  challenge,
  groupId,
  onChanged,
}: {
  challenge: MyGroupChallenge;
  groupId: string;
  onChanged: () => void;
}) {
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
    <View style={styles.challenge}>
      <View style={styles.challengeHeader}>
        <Text style={styles.challengeName}>{challenge.name}</Text>
        <StatusBadge status={challenge.status} />
      </View>
      <Text style={styles.body}>{challenge.target}</Text>
      <Text style={styles.muted}>
        {formatDateRange(challenge.startDate, challenge.endDate)}
        {left ? ` · ${left}` : ''}
      </Text>
      {challenge.description ? <Text style={styles.body}>{challenge.description}</Text> : null}

      {challenge.collective ? (
        <>
          <CollectiveBar type={challenge.type} collective={challenge.collective} />
          {challenge.series ? <TeamChart type={challenge.type} series={challenge.series} /> : null}
          {challenge.joined && challenge.me ? <ContributionLine label="Your share" type={challenge.type} progress={challenge.me} /> : null}
          <Text style={styles.muted}>
            {challenge.team.participants} of {challenge.team.members} members are adding to the total
          </Text>
        </>
      ) : (
        <>
          {challenge.joined && challenge.me ? <ProgressLine label="You" progress={challenge.me} /> : null}
          <Text style={styles.muted}>Team: {teamStatusLine(challenge.team)}</Text>
        </>
      )}

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {challenge.status !== 'ENDED' ? (
        <Button
          title={challenge.joined ? 'Leave this challenge' : 'Join this challenge'}
          variant={challenge.joined ? 'outline' : 'primary'}
          size="sm"
          loading={busy}
          onPress={toggle}
        />
      ) : !challenge.joined ? (
        <Text style={styles.muted}>You did not take part in this challenge.</Text>
      ) : null}
    </View>
  );
}

function GroupSection({ group, onLeft }: { group: MyGroup; onLeft: () => void }) {
  const [challenges, setChallenges] = useState<MyGroupChallenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(() => {
    listMyGroupChallenges(group.id)
      .then((list) => {
        setChallenges(list);
        setError(null);
      })
      .catch(() => setError('Could not load the challenges.'));
  }, [group.id]);

  useEffect(load, [load]);

  async function handleLeave() {
    const confirmed = await confirmDestructive(
      `Leave ${group.name}?`,
      'The group’s administrators will no longer be able to see your health data, and you will be removed from its challenges.',
      'Leave group',
    );
    if (!confirmed) return;
    setLeaving(true);
    try {
      await leaveGroup(group.id);
      onLeft();
    } catch {
      setError('Could not leave the group. Please try again.');
      setLeaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.groupHeader}>
        <GroupLogo logoUrl={group.logoUrl} />
        <View style={styles.flex}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.muted}>
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'} · joined {formatDay(group.joinedAt.slice(0, 10))}
          </Text>
        </View>
      </View>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {challenges === null && !error ? <ActivityIndicator color={colors.primary.default} /> : null}
      {challenges && challenges.length === 0 ? (
        <Text style={styles.muted}>No challenges yet. When an administrator creates one you will get a notification.</Text>
      ) : null}
      {challenges?.map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} groupId={group.id} onChanged={load} />
      ))}

      <Button title="Leave this group" variant="ghost" size="sm" loading={leaving} onPress={handleLeave} />
    </Card>
  );
}

export default function WellbeingScreen() {
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyWellbeing()
      .then((result) => {
        setGroups(result.groups);
        setInvitations(result.pendingInvitations);
        setError(null);
      })
      .catch(() => setError('Could not load your groups.'));
  }, []);

  useFocusEffect(load);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Groups you belong to through your company or team. Joining a group lets its administrators see your health data;
        challenges are always optional.
      </Text>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {groups === null && !error ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      ) : null}

      {invitations.map((invitation) => (
        <InvitationCard key={invitation.id} invitation={invitation} onAccepted={load} />
      ))}

      {groups?.map((group) => (
        <GroupSection key={group.id} group={group} onLeft={load} />
      ))}

      {groups && groups.length === 0 && invitations.length === 0 ? (
        <Card>
          <Text style={styles.body}>
            You are not in any group yet. When an administrator invites you by email, the invitation shows up here.
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  flex: { flex: 1 },
  centered: { paddingVertical: 24, alignItems: 'center' },
  intro: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground, lineHeight: 19 },
  card: { gap: 14 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupName: { fontFamily: fontFamily.display, fontSize: 20, color: colors.foreground },
  body: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  muted: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground, lineHeight: 18 },
  challenge: {
    gap: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.card.border,
  },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  challengeName: { flexShrink: 1, fontFamily: fontFamily.sansSemibold, fontSize: 16, color: colors.foreground },
});

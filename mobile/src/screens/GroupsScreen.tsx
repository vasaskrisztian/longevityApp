import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  acceptInvitationById,
  getMyWellbeing,
  groupErrorMessage,
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
import { VideoChallengePanel } from '@/src/components/wellbeing/VideoChallengePanel';
import { CollectiveBar, ContributionLine, GroupLogo, ProgressLine, StatusBadge } from '@/src/components/wellbeing/parts';
import { useT } from '@/src/i18n';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { setPendingInvitations } from '@/src/wellbeing/pendingInvitationsStore';
import { confirmDestructive } from '@/src/utils/confirm';
import { daysLeftLabel, formatDateRange, formatDay, teamStatusLine } from '@/src/wellbeing/format';

/**
 * Member side of corporate wellbeing: invitations waiting to be accepted
 * (with the explicit health-data consent), the groups the person belongs to,
 * and each group's challenges — join voluntarily, see your own progress and
 * the team's aggregate (never other people's data). Leaving a group ends the
 * administrators' access immediately.
 */

function InvitationCard({ invitation, onAccepted, highlight }: { invitation: PendingInvitation; onAccepted: () => void; highlight?: boolean }) {
  const { t } = useT();
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
      setError(groupErrorMessage(err, t('groups.invitation.acceptFailed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={[styles.card, highlight && styles.highlight]}>
      <View style={styles.groupHeader}>
        <GroupLogo logoUrl={invitation.logoUrl} />
        <View style={styles.flex}>
          <Text style={styles.groupName}>{invitation.groupName}</Text>
          <Text style={styles.muted}>{t('groups.invitation.validUntil', { date: formatDay(invitation.expiresAt.slice(0, 10)) })}</Text>
        </View>
      </View>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Checkbox
        label={t('groups.invitation.consent', { name: invitation.groupName })}
        checked={consent}
        onChange={setConsent}
      />
      <Button title={t('groups.invitation.accept')} onPress={accept} disabled={!consent} loading={busy} />
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
  const { t } = useT();
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
      setError(groupErrorMessage(err, t('groups.challenge.failed')));
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
      {challenge.video ? <VideoChallengePanel challenge={challenge} groupId={groupId} onChanged={onChanged} /> : null}

      {challenge.collective ? (
        <>
          <CollectiveBar type={challenge.type} collective={challenge.collective} />
          {challenge.series ? <TeamChart type={challenge.type} series={challenge.series} /> : null}
          {challenge.joined && challenge.me ? <ContributionLine label={t('groups.challenge.yourShare')} type={challenge.type} progress={challenge.me} /> : null}
          <Text style={styles.muted}>
            {t('groups.challenge.contributors', { participants: challenge.team.participants, members: challenge.team.members })}
          </Text>
        </>
      ) : (
        <>
          {challenge.joined && challenge.me ? <ProgressLine label={t('groups.challenge.you')} progress={challenge.me} /> : null}
          <Text style={styles.muted}>{t('groups.challenge.team', { status: teamStatusLine(challenge.team) })}</Text>
        </>
      )}

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {challenge.status !== 'ENDED' && !challenge.joined ? (
        <Text style={styles.muted}>{t('groups.challenge.joinNote')}</Text>
      ) : null}
      {challenge.status !== 'ENDED' ? (
        <Button
          title={challenge.joined ? t('groups.challenge.leave') : t('groups.challenge.join')}
          variant={challenge.joined ? 'outline' : 'primary'}
          size="sm"
          loading={busy}
          onPress={toggle}
        />
      ) : !challenge.joined ? (
        <Text style={styles.muted}>{t('groups.challenge.notTakenPart')}</Text>
      ) : null}
    </View>
  );
}

function GroupSection({ group, onLeft, highlight }: { group: MyGroup; onLeft: () => void; highlight?: boolean }) {
  const { t } = useT();
  const [challenges, setChallenges] = useState<MyGroupChallenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(() => {
    listMyGroupChallenges(group.id)
      .then((list) => {
        setChallenges(list);
        setError(null);
      })
      .catch(() => setError(t('groups.group.challengesLoadFailed')));
  }, [group.id, t]);

  useEffect(load, [load]);

  async function handleLeave() {
    const confirmed = await confirmDestructive(
      t('account.sharing.leaveTitle', { name: group.name }),
      t('account.sharing.leaveMessage'),
      t('account.sharing.leaveConfirm'),
    );
    if (!confirmed) return;
    setLeaving(true);
    try {
      await leaveGroup(group.id);
      onLeft();
    } catch {
      setError(t('account.sharing.leaveFailed'));
      setLeaving(false);
    }
  }

  return (
    <Card style={[styles.card, highlight && styles.highlight]}>
      <View style={styles.groupHeader}>
        <GroupLogo logoUrl={group.logoUrl} />
        <View style={styles.flex}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.muted}>
            {t('groups.group.summary', { count: group.memberCount, date: formatDay(group.joinedAt.slice(0, 10)) })}
          </Text>
        </View>
      </View>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {challenges === null && !error ? <ActivityIndicator color={colors.primary.default} /> : null}
      {challenges && challenges.length === 0 ? (
        <Text style={styles.muted}>{t('groups.group.noChallenges')}</Text>
      ) : null}
      {challenges?.map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} groupId={group.id} onChanged={load} />
      ))}

      <Button title={t('groups.group.leave')} variant="ghost" size="sm" loading={leaving} onPress={handleLeave} />
    </Card>
  );
}

export default function GroupsScreen() {
  const { t } = useT();
  // Set when opened from a notification (see notifications/route.ts): that invitation / group is shown first and outlined.
  const { invitation: focusInvitation, group: focusGroup } = useLocalSearchParams<{ invitation?: string; group?: string }>();
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyWellbeing()
      .then((result) => {
        setGroups(result.groups);
        setInvitations(result.pendingInvitations);
        setPendingInvitations(result.pendingInvitations.length);
        setError(null);
      })
      .catch(() => setError(t('account.sharing.loadFailed')));
  }, [t]);

  useFocusEffect(load);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>{t('groups.intro')}</Text>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {groups === null && !error ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      ) : null}

      {[...invitations]
        .sort((a, b) => Number(b.id === focusInvitation) - Number(a.id === focusInvitation))
        .map((invitation) => (
          <InvitationCard key={invitation.id} invitation={invitation} onAccepted={load} highlight={invitation.id === focusInvitation} />
        ))}

      {groups
        ?.slice()
        .sort((a, b) => Number(b.id === focusGroup) - Number(a.id === focusGroup))
        .map((group) => (
          <GroupSection key={group.id} group={group} onLeft={load} highlight={group.id === focusGroup} />
        ))}

      {groups && groups.length === 0 && invitations.length === 0 ? (
        <Card>
          <Text style={styles.body}>{t('groups.empty')}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenBackground },
  content: { padding: 20, gap: 16 },
  flex: { flex: 1 },
  centered: { paddingVertical: 24, alignItems: 'center' },
  intro: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground, lineHeight: 19 },
  card: { gap: 14 },
  highlight: { borderColor: colors.primary.default, borderWidth: 2 },
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

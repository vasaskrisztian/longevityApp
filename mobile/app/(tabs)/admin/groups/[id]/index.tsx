import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  createAdminGroupChallenge,
  deleteAdminGroup,
  getAdminGroup,
  inviteToGroup,
  listAdminGroupChallenges,
  removeGroupMember,
  revokeGroupInvitation,
  updateAdminGroup,
  type AdminGroupChallengeListItem,
  type GroupChallengeMode,
  type GroupChallengeType,
  type GroupDetail,
  type InviteResult,
} from '@/src/api/groups';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipSingleSelect } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { CollectiveBar, GroupLogo, ProgressBar, StatusBadge } from '@/src/components/wellbeing/parts';
import { colors, fontFamily } from '@/src/theme/tokens';
import {
  COLLECTIVE_FIELDS,
  INDIVIDUAL_DEFAULTS,
  goalPayload,
  typeForMode,
  typeOptionsFor,
  validateGoal,
} from '@/src/wellbeing/challengeForm';
import { confirmDestructive } from '@/src/utils/confirm';
import { pickLogo, type PickedLogo } from '@/src/utils/logoPicker';
import {
  addDays,
  daysLeftLabel,
  displayName,
  formatDateRange,
  formatDay,
  parseEmails,
  providerLabel,
  teamStatusLine,
  timeAgo,
  todayDay,
} from '@/src/wellbeing/format';

/**
 * Corporate wellbeing — admin: one group. Edit name/logo, invite people by
 * email, see who accepted (members, with their device sync state) and who
 * has not yet (pending / expired invitations), open a member's health data,
 * and create and follow group challenges.
 */

function EditGroupCard({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const [name, setName] = useState(group.name);
  const [logo, setLogo] = useState<Extract<PickedLogo, { ok: true }> | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function chooseLogo() {
    setError(null);
    const picked = await pickLogo();
    if (!picked) return;
    if (!picked.ok) return setError(picked.message);
    setLogo(picked);
    setRemoveLogo(false);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError('The group needs a name.');
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateAdminGroup(group.id, {
        name: trimmed,
        ...(logo ? { logo: logo.upload } : removeLogo ? { logo: null } : {}),
      });
      setLogo(null);
      setRemoveLogo(false);
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the group.');
    } finally {
      setSaving(false);
    }
  }

  const showCurrent = !logo && !removeLogo && group.logoUrl;

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Group details</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {saved ? <Alert variant="success">Saved.</Alert> : null}
      <TextField label="Group name" value={name} onChangeText={setName} maxLength={120} />
      <View style={styles.logoRow}>
        {logo ? (
          <Image source={{ uri: logo.previewUri }} style={styles.logoPreview} resizeMode="contain" accessibilityLabel="Selected logo" alt="Selected logo" />
        ) : (
          <GroupLogo logoUrl={showCurrent ? group.logoUrl : null} size={56} />
        )}
        <View style={styles.logoActions}>
          <Button title="Choose a logo" size="sm" variant="outline" onPress={chooseLogo} />
          {(group.logoUrl || logo) && !removeLogo ? (
            <Button
              title="Remove logo"
              size="sm"
              variant="ghost"
              onPress={() => {
                setLogo(null);
                setRemoveLogo(true);
              }}
            />
          ) : null}
        </View>
      </View>
      <Button title="Save" onPress={save} loading={saving} />
    </Card>
  );
}

function InviteCard({ groupId, onInvited }: { groupId: string; onInvited: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const emails = parseEmails(text);

  async function send() {
    if (emails.length === 0) return setError('Enter at least one email address.');
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const outcome = await inviteToGroup(groupId, emails);
      setResults(outcome);
      setText('');
      onInvited();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not send the invitations.');
    } finally {
      setBusy(false);
    }
  }

  const invited = results?.filter((r) => r.outcome === 'invited').length ?? 0;
  const already = results?.filter((r) => r.outcome === 'already_member').map((r) => r.email) ?? [];

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Invite people</Text>
      <Text style={styles.muted}>
        They get an email with a link. Whoever accepts and registers (or signs in) joins the group and shows up below.
      </Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {results ? (
        <Alert variant="success">
          {`${invited} ${invited === 1 ? 'invitation' : 'invitations'} sent.${already.length ? ` Already members: ${already.join(', ')}.` : ''}`}
        </Alert>
      ) : null}
      <TextField
        label="Email addresses"
        value={text}
        onChangeText={setText}
        placeholder="anna@company.com, bela@company.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        multiline
        numberOfLines={3}
      />
      <Text style={styles.muted}>Separate addresses with commas, spaces or new lines.{emails.length ? ` ${emails.length} recognised.` : ''}</Text>
      <Button title={busy ? 'Sending…' : 'Send invitations'} onPress={send} loading={busy} disabled={emails.length === 0} />
    </Card>
  );
}

function MembersCard({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);

  async function remove(userId: string, label: string) {
    const ok = await confirmDestructive(
      `Remove ${label}?`,
      'They leave the group and its challenges, and you will no longer see their health data.',
      'Remove',
    );
    if (!ok) return;
    try {
      await removeGroupMember(group.id, userId);
      onChanged();
    } catch {
      setError('Could not remove the member.');
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Members ({group.members.length})</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {group.members.length === 0 ? (
        <Text style={styles.muted}>Nobody has joined yet. People appear here once they accept their invitation.</Text>
      ) : null}
      {group.members.map((member) => (
        <View key={member.userId} style={styles.listRow}>
          <Pressable
            style={styles.flex}
            accessibilityRole="button"
            onPress={() => router.push(`/admin/groups/${group.id}/members/${member.userId}`)}
          >
            <Text style={styles.rowTitle}>{displayName(member)}</Text>
            {member.fullName ? <Text style={styles.muted}>{member.email}</Text> : null}
            <Text style={styles.muted}>
              {member.connectedProviders.length
                ? `${member.connectedProviders.map(providerLabel).join(', ')} · ${member.lastSyncAt ? `synced ${timeAgo(member.lastSyncAt)}` : 'not synced yet'}`
                : 'No device connected'}
            </Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
          <Button title="Remove" size="sm" variant="ghost" onPress={() => remove(member.userId, displayName(member))} />
        </View>
      ))}
    </Card>
  );
}

function InvitationsCard({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  if (group.invitations.length === 0) return null;

  async function resend(id: string, email: string) {
    setBusyId(id);
    setError(null);
    try {
      await inviteToGroup(group.id, [email]);
      onChanged();
    } catch {
      setError('Could not resend the invitation.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await revokeGroupInvitation(group.id, id);
      onChanged();
    } catch {
      setError('Could not cancel the invitation.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Invitations not accepted yet ({group.invitations.length})</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {group.invitations.map((invitation) => (
        <View key={invitation.id} style={styles.listRow}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{invitation.email}</Text>
            <Text style={[styles.muted, invitation.state === 'EXPIRED' && { color: colors.warning }]}>
              {invitation.state === 'EXPIRED' ? 'Expired' : 'Waiting'} · sent {timeAgo(invitation.sentAt)}
              {invitation.state === 'PENDING' ? ` · valid until ${formatDay(invitation.expiresAt.slice(0, 10))}` : ''}
            </Text>
          </View>
          <Button title="Resend" size="sm" variant="outline" loading={busyId === invitation.id} onPress={() => resend(invitation.id, invitation.email)} />
          <Button title="Cancel" size="sm" variant="ghost" disabled={busyId === invitation.id} onPress={() => cancel(invitation.id)} />
        </View>
      ))}
    </Card>
  );
}

const MODE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Personal goals' },
  { value: 'COLLECTIVE', label: 'Team total' },
];

const MODE_HINT: Record<GroupChallengeMode, string> = {
  INDIVIDUAL: 'Everyone has to reach their own target.',
  COLLECTIVE: 'Everyone’s results are added up to one shared target.',
};

const TYPE_OPTIONS = [
  { value: 'DAILY_STEPS', label: 'Daily steps' },
  { value: 'SLEEP_SCORE', label: 'Sleep score' },
  { value: 'WEEKLY_WORKOUTS', label: 'Weekly workouts' },
];

const TYPE_FIELDS: Record<GroupChallengeType, { threshold: string; count: string; hint: string }> = {
  DAILY_STEPS: { threshold: 'Steps per day (more than)', count: 'Number of days', hint: 'A day counts when the steps are above the limit.' },
  SLEEP_SCORE: { threshold: 'Sleep score (above)', count: 'Number of nights', hint: 'A night counts when the sleep score is above the limit.' },
  WEEKLY_WORKOUTS: {
    threshold: 'Workouts per week (more than)',
    count: 'Number of weeks',
    hint: 'A week counts when the person logged more workouts than the limit.',
  },
};

function NewChallengeCard({ groupId, onCreated }: { groupId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<GroupChallengeMode>('INDIVIDUAL');
  const [type, setType] = useState<GroupChallengeType>('DAILY_STEPS');
  const [targetTotal, setTargetTotal] = useState(COLLECTIVE_FIELDS.DAILY_STEPS?.default ?? '');
  const [threshold, setThreshold] = useState('8000');
  const [requiredCount, setRequiredCount] = useState('10');
  const [startDate, setStartDate] = useState(todayDay());
  const [endDate, setEndDate] = useState(addDays(todayDay(), 29));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function changeType(next: string) {
    const value = next as GroupChallengeType;
    setType(value);
    setThreshold(INDIVIDUAL_DEFAULTS[value][0]);
    setRequiredCount(INDIVIDUAL_DEFAULTS[value][1]);
    setTargetTotal(COLLECTIVE_FIELDS[value]?.default ?? '');
  }

  function changeMode(next: string) {
    const value = next as GroupChallengeMode;
    setMode(value);
    // Sleep scores cannot be added up — fall back to steps when switching to a team total.
    const adjusted = typeForMode(value, type);
    if (adjusted !== type) changeType(adjusted);
  }

  async function create() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Give the challenge a name.';
    const goal = { mode, type, threshold, requiredCount, targetTotal };
    Object.assign(next, validateGoal(goal));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) next.startDate = 'Use yyyy-mm-dd.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) next.endDate = 'Use yyyy-mm-dd.';
    if (!next.startDate && !next.endDate && endDate < startDate) next.endDate = 'The end cannot be before the start.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setServerError(null);
    try {
      await createAdminGroupChallenge(groupId, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        type,
        ...goalPayload(goal),
        startDate,
        endDate,
      });
      setName('');
      setDescription('');
      setOpen(false);
      onCreated();
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : 'Could not create the challenge.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <Button title="New challenge" variant="outline" onPress={() => setOpen(true)} />;
  }
  const fields = TYPE_FIELDS[type];
  const collectiveFields = mode === 'COLLECTIVE' ? COLLECTIVE_FIELDS[type] : undefined;
  const typeOptions = typeOptionsFor(mode, TYPE_OPTIONS);
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>New challenge</Text>
      <Text style={styles.muted}>Every member gets an in-app notification and can join voluntarily.</Text>
      {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
      <TextField label="Name" value={name} onChangeText={setName} error={errors.name} maxLength={200} />
      <TextField label="Description (optional)" value={description} onChangeText={setDescription} multiline numberOfLines={2} maxLength={1000} />
      <ChipSingleSelect label="How is it won?" options={MODE_OPTIONS} value={mode} onChange={changeMode} />
      <Text style={styles.muted}>{MODE_HINT[mode]}</Text>
      <ChipSingleSelect label="Type" options={typeOptions} value={type} onChange={changeType} />
      <Text style={styles.muted}>{collectiveFields ? collectiveFields.hint : fields.hint}</Text>
      {collectiveFields ? (
        <TextField label={collectiveFields.label} value={targetTotal} onChangeText={setTargetTotal} keyboardType="numeric" error={errors.targetTotal} />
      ) : (
        <>
          <TextField label={fields.threshold} value={threshold} onChangeText={setThreshold} keyboardType="numeric" error={errors.threshold} />
          <TextField label={fields.count} value={requiredCount} onChangeText={setRequiredCount} keyboardType="numeric" error={errors.requiredCount} />
        </>
      )}
      <TextField label="First day (yyyy-mm-dd)" value={startDate} onChangeText={setStartDate} autoCapitalize="none" error={errors.startDate} />
      <TextField label="Last day (yyyy-mm-dd)" value={endDate} onChangeText={setEndDate} autoCapitalize="none" error={errors.endDate} />
      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" style={styles.flex} onPress={() => setOpen(false)} />
        <Button title="Create challenge" style={styles.flex} loading={busy} onPress={create} />
      </View>
    </Card>
  );
}

function ChallengesCard({
  groupId,
  challenges,
  onChanged,
}: {
  groupId: string;
  challenges: AdminGroupChallengeListItem[] | null;
  onChanged: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Text style={styles.sectionTitle}>Challenges</Text>
      <NewChallengeCard groupId={groupId} onCreated={onChanged} />
      {challenges === null ? <ActivityIndicator color={colors.primary.default} /> : null}
      {challenges && challenges.length === 0 ? <Text style={styles.muted}>No challenges yet.</Text> : null}
      {challenges?.map((challenge) => (
        <Pressable
          key={challenge.id}
          accessibilityRole="button"
          onPress={() => router.push(`/admin/groups/${groupId}/challenges/${challenge.id}`)}
        >
          <Card style={styles.card}>
            <View style={styles.challengeHeader}>
              <Text style={[styles.rowTitle, styles.flex]}>{challenge.name}</Text>
              <StatusBadge status={challenge.status} />
            </View>
            <Text style={styles.body}>{challenge.target}</Text>
            <Text style={styles.muted}>
              {formatDateRange(challenge.startDate, challenge.endDate)}
              {daysLeftLabel(challenge.daysRemaining) ? ` · ${daysLeftLabel(challenge.daysRemaining)}` : ''}
            </Text>
            {challenge.collective ? (
              <CollectiveBar type={challenge.type} collective={challenge.collective} />
            ) : (
              <>
                <ProgressBar percent={challenge.team.averagePercent} />
                <Text style={styles.muted}>{teamStatusLine(challenge.team)}</Text>
              </>
            )}
            <Text style={styles.muted}>
              {challenge.team.participants} of {challenge.team.members} members joined
            </Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

export default function AdminGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [challenges, setChallenges] = useState<AdminGroupChallengeListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    getAdminGroup(id)
      .then((detail) => {
        setGroup(detail);
        setError(null);
      })
      .catch(() => setError('Could not load this group.'));
    listAdminGroupChallenges(id)
      .then(setChallenges)
      .catch(() => setChallenges([]));
  }, [id]);

  useFocusEffect(load);

  async function handleDelete() {
    if (!group) return;
    const ok = await confirmDestructive(
      `Delete ${group.name}?`,
      'This removes the group, its invitations, memberships and challenges. The people keep their accounts and data.',
      'Delete group',
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAdminGroup(group.id);
      router.replace('/admin/groups');
    } catch {
      setError('Could not delete the group.');
      setDeleting(false);
    }
  }

  if (error && !group) {
    return (
      <View style={styles.centeredPage}>
        <Alert variant="destructive">{error}</Alert>
      </View>
    );
  }
  if (!group) {
    return (
      <View style={styles.centeredPage}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <GroupLogo logoUrl={group.logoUrl} size={56} />
        <View style={styles.flex}>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.muted}>
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
            {group.pendingInvitationCount ? ` · ${group.pendingInvitationCount} invitations waiting` : ''}
          </Text>
        </View>
      </View>
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <MembersCard group={group} onChanged={load} />
      <InvitationsCard group={group} onChanged={load} />
      <InviteCard groupId={group.id} onInvited={load} />
      <ChallengesCard groupId={group.id} challenges={challenges} onChanged={load} />
      <EditGroupCard key={`${group.name}:${group.logoUrl ?? ''}`} group={group} onChanged={load} />
      <Button title="Delete this group" variant="destructive" loading={deleting} onPress={handleDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  centeredPage: { flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  stack: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: fontFamily.display, fontSize: 24, color: colors.foreground },
  sectionTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 17, color: colors.foreground },
  card: { gap: 12 },
  cardTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 17, color: colors.foreground },
  rowTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 15, color: colors.foreground },
  body: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.foreground },
  muted: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground, lineHeight: 18 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.card.border,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoPreview: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.muted.default },
  logoActions: { flex: 1, gap: 6, alignItems: 'flex-start' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

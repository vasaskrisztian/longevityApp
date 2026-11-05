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
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { t, useT } from '@/src/i18n';
import { useTabParam } from '@/src/navigation/useTabParam';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipSingleSelect } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { CollectiveBar, GroupLogo, ProgressBar, StatusBadge } from '@/src/components/wellbeing/parts';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
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
  challengeTargetText,
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

const GROUP_SEGMENTS = ['overview', 'challenges', 'settings'] as const;

function EditGroupCard({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const { t } = useT();
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
    if (!trimmed) return setError(t('admin.group.details.nameRequired'));
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
      setError(err instanceof Error ? err.message : t('admin.group.details.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const showCurrent = !logo && !removeLogo && group.logoUrl;

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('admin.group.details.title')}</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {saved ? <Alert variant="success">{t('admin.group.details.saved')}</Alert> : null}
      <TextField label={t('admin.groups.name')} value={name} onChangeText={setName} maxLength={120} />
      <View style={styles.logoRow}>
        {logo ? (
          <Image source={{ uri: logo.previewUri }} style={styles.logoPreview} resizeMode="contain" accessibilityLabel={t('admin.logo.selected')} alt={t('admin.logo.selected')} />
        ) : (
          <GroupLogo logoUrl={showCurrent ? group.logoUrl : null} size={56} />
        )}
        <View style={styles.logoActions}>
          <Button title={t('admin.logo.choose')} size="sm" variant="outline" onPress={chooseLogo} />
          {(group.logoUrl || logo) && !removeLogo ? (
            <Button
              title={t('admin.logo.remove')}
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
      <Button title={t('common.save')} onPress={save} loading={saving} />
    </Card>
  );
}

function InviteCard({ groupId, onInvited }: { groupId: string; onInvited: () => void }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const emails = parseEmails(text);

  async function send() {
    if (emails.length === 0) return setError(t('admin.group.invite.needOne'));
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const outcome = await inviteToGroup(groupId, emails);
      setResults(outcome);
      setText('');
      onInvited();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('admin.group.invite.sendFailed'));
    } finally {
      setBusy(false);
    }
  }

  const invited = results?.filter((r) => r.outcome === 'invited').length ?? 0;
  const already = results?.filter((r) => r.outcome === 'already_member').map((r) => r.email) ?? [];

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('admin.group.invite.title')}</Text>
      <Text style={styles.muted}>{t('admin.group.invite.description')}</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {results ? (
        <Alert variant="success">
          {`${t('admin.group.invite.sent', { count: invited })}${already.length ? ` ${t('admin.group.invite.alreadyMembers', { emails: already.join(', ') })}` : ''}`}
        </Alert>
      ) : null}
      <TextField
        label={t('admin.group.invite.emailsLabel')}
        value={text}
        onChangeText={setText}
        placeholder={t('admin.group.invite.emailsPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        multiline
        numberOfLines={3}
      />
      <Text style={styles.muted}>
        {t('admin.group.invite.separatorHint')}
        {emails.length ? ` ${t('admin.group.invite.recognised', { count: emails.length })}` : ''}
      </Text>
      <Button title={busy ? t('admin.group.invite.sending') : t('admin.group.invite.send')} onPress={send} loading={busy} disabled={emails.length === 0} />
    </Card>
  );
}

function MembersCard({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);

  async function remove(userId: string, label: string) {
    const ok = await confirmDestructive(
      t('admin.group.members.removeTitle', { name: label }),
      t('admin.group.members.removeMessage'),
      t('common.remove'),
    );
    if (!ok) return;
    try {
      await removeGroupMember(group.id, userId);
      onChanged();
    } catch {
      setError(t('admin.group.members.removeFailed'));
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('admin.group.members.title', { count: group.members.length })}</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {group.members.length === 0 ? (
        <Text style={styles.muted}>{t('admin.group.members.empty')}</Text>
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
                ? member.lastSyncAt
                  ? t('admin.group.members.synced', {
                      providers: member.connectedProviders.map(providerLabel).join(', '),
                      when: timeAgo(member.lastSyncAt),
                    })
                  : t('admin.group.members.notSynced', { providers: member.connectedProviders.map(providerLabel).join(', ') })
                : t('admin.group.members.noDevice')}
            </Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
          <Button title={t('common.remove')} size="sm" variant="ghost" onPress={() => remove(member.userId, displayName(member))} />
        </View>
      ))}
    </Card>
  );
}

function InvitationsCard({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const { t } = useT();
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
      setError(t('admin.group.invitations.resendFailed'));
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
      setError(t('admin.group.invitations.cancelFailed'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('admin.group.invitations.title', { count: group.invitations.length })}</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {group.invitations.map((invitation) => (
        <View key={invitation.id} style={styles.listRow}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{invitation.email}</Text>
            <Text style={[styles.muted, invitation.state === 'EXPIRED' && { color: colors.warning }]}>
              {invitation.state === 'EXPIRED'
                ? t('admin.group.invitations.expired', { sent: timeAgo(invitation.sentAt) })
                : invitation.state === 'PENDING'
                  ? t('admin.group.invitations.waitingUntil', {
                      sent: timeAgo(invitation.sentAt),
                      until: formatDay(invitation.expiresAt.slice(0, 10)),
                    })
                  : t('admin.group.invitations.waiting', { sent: timeAgo(invitation.sentAt) })}
            </Text>
          </View>
          <Button title={t('admin.group.invitations.resend')} size="sm" variant="outline" loading={busyId === invitation.id} onPress={() => resend(invitation.id, invitation.email)} />
          <Button title={t('common.cancel')} size="sm" variant="ghost" disabled={busyId === invitation.id} onPress={() => cancel(invitation.id)} />
        </View>
      ))}
    </Card>
  );
}

const modeOptions = () => [
  { value: 'INDIVIDUAL', label: t('admin.challengeForm.modeIndividual') },
  { value: 'COLLECTIVE', label: t('admin.challengeForm.modeCollective') },
];

const modeHint = (mode: GroupChallengeMode): string =>
  mode === 'INDIVIDUAL' ? t('admin.challengeForm.modeHintIndividual') : t('admin.challengeForm.modeHintCollective');

const typeOptions = () => [
  { value: 'DAILY_STEPS', label: t('enum.DAILY_STEPS') },
  { value: 'SLEEP_SCORE', label: t('enum.SLEEP_SCORE') },
  { value: 'WEEKLY_WORKOUTS', label: t('enum.WEEKLY_WORKOUTS') },
  { value: 'VIDEO_SESSIONS', label: t('admin.challengeForm.typeVideo') },
];

/** The labels and hint of a personal-goal challenge type (translated when read). */
const typeFields = (type: GroupChallengeType): { threshold: string; count: string; hint: string } => {
  switch (type) {
    case 'DAILY_STEPS':
      return {
        threshold: t('admin.challengeForm.stepsThreshold'),
        count: t('admin.challengeForm.stepsCount'),
        hint: t('admin.challengeForm.stepsHint'),
      };
    case 'SLEEP_SCORE':
      return {
        threshold: t('admin.challengeForm.sleepThreshold'),
        count: t('admin.challengeForm.sleepCount'),
        hint: t('admin.challengeForm.sleepHint'),
      };
    case 'WEEKLY_WORKOUTS':
      return {
        threshold: t('admin.challengeForm.workoutsThreshold'),
        count: t('admin.challengeForm.workoutsCount'),
        hint: t('admin.challengeForm.workoutsHint'),
      };
    case 'VIDEO_SESSIONS':
      return { threshold: '', count: t('admin.challengeForm.videoCount'), hint: t('admin.challengeForm.videoHint') };
  }
};

function NewChallengeCard({ groupId, onCreated }: { groupId: string; onCreated: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<GroupChallengeMode>('INDIVIDUAL');
  const [type, setType] = useState<GroupChallengeType>('DAILY_STEPS');
  const [targetTotal, setTargetTotal] = useState(COLLECTIVE_FIELDS.DAILY_STEPS?.default ?? '');
  const [threshold, setThreshold] = useState('8000');
  const [requiredCount, setRequiredCount] = useState('10');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
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
    if (!name.trim()) next.name = t('admin.challengeForm.nameRequired');
    const goal = { mode, type, threshold, requiredCount, targetTotal, videoUrl, videoTitle, videoDuration };
    Object.assign(next, validateGoal(goal));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) next.startDate = t('admin.challengeForm.dateFormat');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) next.endDate = t('admin.challengeForm.dateFormat');
    if (!next.startDate && !next.endDate && endDate < startDate) next.endDate = t('admin.challengeForm.endBeforeStart');
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
      setVideoUrl('');
      setVideoTitle('');
      setOpen(false);
      onCreated();
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : t('admin.challengeForm.createFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <Button title={t('admin.challengeForm.new')} variant="outline" onPress={() => setOpen(true)} />;
  }
  const fields = typeFields(type);
  const collectiveFields = mode === 'COLLECTIVE' ? COLLECTIVE_FIELDS[type] : undefined;
  const typeChips = typeOptionsFor(mode, typeOptions());
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('admin.challengeForm.new')}</Text>
      <Text style={styles.muted}>{t('admin.challengeForm.intro')}</Text>
      {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
      <TextField label={t('admin.challengeForm.name')} value={name} onChangeText={setName} error={errors.name} maxLength={200} />
      <TextField label={t('admin.challengeForm.description')} value={description} onChangeText={setDescription} multiline numberOfLines={2} maxLength={1000} />
      <ChipSingleSelect label={t('admin.challengeForm.mode')} options={modeOptions()} value={mode} onChange={changeMode} />
      <Text style={styles.muted}>{modeHint(mode)}</Text>
      <ChipSingleSelect label={t('admin.challengeForm.type')} options={typeChips} value={type} onChange={changeType} />
      <Text style={styles.muted}>{collectiveFields ? collectiveFields.hint : fields.hint}</Text>
      {type === 'VIDEO_SESSIONS' ? (
        <>
          <TextField label={t('admin.challengeForm.youtubeLink')} value={videoUrl} onChangeText={setVideoUrl} autoCapitalize="none" keyboardType="url" error={errors.videoUrl} maxLength={500} />
          <TextField label={t('admin.challengeForm.videoTitle')} value={videoTitle} onChangeText={setVideoTitle} maxLength={200} />
          <TextField label={t('admin.challengeForm.videoLength')} value={videoDuration} onChangeText={setVideoDuration} autoCapitalize="none" error={errors.videoDuration} />
          <Text style={styles.muted}>{t('admin.challengeForm.videoLengthHint')}</Text>
        </>
      ) : null}
      {collectiveFields ? (
        <TextField label={collectiveFields.label} value={targetTotal} onChangeText={setTargetTotal} keyboardType="numeric" error={errors.targetTotal} />
      ) : (
        <>
          {type === 'VIDEO_SESSIONS' ? null : (
            <TextField label={fields.threshold} value={threshold} onChangeText={setThreshold} keyboardType="numeric" error={errors.threshold} />
          )}
          <TextField label={fields.count} value={requiredCount} onChangeText={setRequiredCount} keyboardType="numeric" error={errors.requiredCount} />
        </>
      )}
      <TextField label={t('admin.challengeForm.firstDay')} value={startDate} onChangeText={setStartDate} autoCapitalize="none" error={errors.startDate} />
      <TextField label={t('admin.challengeForm.lastDay')} value={endDate} onChangeText={setEndDate} autoCapitalize="none" error={errors.endDate} />
      <View style={styles.buttonRow}>
        <Button title={t('common.cancel')} variant="outline" style={styles.flex} onPress={() => setOpen(false)} />
        <Button title={t('admin.challengeForm.create')} style={styles.flex} loading={busy} onPress={create} />
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
  const { t } = useT();
  return (
    <View style={styles.stack}>
      <Text style={styles.sectionTitle}>{t('admin.challenges.title')}</Text>
      <NewChallengeCard groupId={groupId} onCreated={onChanged} />
      {challenges === null ? <ActivityIndicator color={colors.primary.default} /> : null}
      {challenges && challenges.length === 0 ? <Text style={styles.muted}>{t('admin.challenges.none')}</Text> : null}
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
            <Text style={styles.body}>{challengeTargetText(challenge)}</Text>
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
              {t('admin.challenges.joined', { participants: challenge.team.participants, members: challenge.team.members })}
            </Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

export default function AdminGroupScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [segment, setSegment] = useTabParam(GROUP_SEGMENTS, 'overview');
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
      .catch(() => setError(t('admin.group.loadFailed')));
    listAdminGroupChallenges(id)
      .then(setChallenges)
      .catch(() => setChallenges([]));
  }, [id, t]);

  useFocusEffect(load);

  async function handleDelete() {
    if (!group) return;
    const ok = await confirmDestructive(
      t('admin.group.deleteTitle', { name: group.name }),
      t('admin.group.deleteMessage'),
      t('admin.group.deleteConfirm'),
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAdminGroup(group.id);
      router.replace('/admin?tab=groups');
    } catch {
      setError(t('admin.group.deleteFailed'));
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
            {t('admin.memberCount', { count: group.memberCount })}
            {group.pendingInvitationCount ? ` · ${t('admin.group.invitationsWaiting', { count: group.pendingInvitationCount })}` : ''}
          </Text>
        </View>
      </View>
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <SegmentedControl
        options={[
          { value: 'overview', label: t('admin.group.segment.overview') },
          { value: 'challenges', label: t('admin.group.segment.challenges') },
          { value: 'settings', label: t('admin.group.segment.settings') },
        ]}
        value={segment}
        onChange={setSegment}
      />

      {segment === 'overview' ? (
        <>
          <MembersCard group={group} onChanged={load} />
          <InvitationsCard group={group} onChanged={load} />
          <InviteCard groupId={group.id} onInvited={load} />
        </>
      ) : null}

      {segment === 'challenges' ? <ChallengesCard groupId={group.id} challenges={challenges} onChanged={load} /> : null}

      {segment === 'settings' ? (
        <>
          <EditGroupCard key={`${group.name}:${group.logoUrl ?? ''}`} group={group} onChanged={load} />
          <Button title={t('admin.group.delete')} variant="destructive" loading={deleting} onPress={handleDelete} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenBackground },
  content: { padding: 20, gap: 16 },
  centeredPage: { flex: 1, backgroundColor: screenBackground, padding: 20, justifyContent: 'center', alignItems: 'center' },
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

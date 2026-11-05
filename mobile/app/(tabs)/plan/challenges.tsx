import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  activateChallenge,
  createChallenge,
  deleteChallenge,
  listChallenges,
  setChallengeVisibility,
  updateChallengeTerms,
  type Challenge,
  type ChallengeStatus,
} from '@/src/api/challenges';
import { getPublicProfileStatus } from '@/src/api/creators';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { t, tDynamic, useT, type TextKey } from '@/src/i18n';
import { confirmDestructive } from '@/src/utils/confirm';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { ChallengeTypeEnum, CreateChallengeSchema, enumLabel, type CreateChallengeInput } from '@/src/validation/schemas';

/**
 * Mirrors the web app's profile/challenges/challenges-manager.tsx. Status
 * and progress are never edited client-side — they're always what the
 * server's computeProgress returned on the last fetch/save, rendered as-is
 * (see claude/phase-15-mobile-migration-plan.md's phase 20 notes on why
 * this keeps the mobile port simple despite the backend's real domain
 * logic). The three PATCH shapes (activate / visibility-only / full-terms
 * edit) stay three distinct api/challenges.ts calls, never collapsed into
 * one generic "update", so the single-field visibility toggle never
 * accidentally gets sent through the terms-edit path.
 */

type ChallengeType = 'SLEEP_SCORE' | 'DAILY_STEPS' | 'WEEKLY_WORKOUTS';

// Text keys per challenge type (keys only — the texts are looked up at render
// time, never at module scope, so they follow the language).
const TYPE_KEYS: Record<
  ChallengeType,
  {
    threshold: TextKey;
    required: TextKey;
    period: TextKey;
    condition: TextKey;
    duration: TextKey;
  }
> = {
  SLEEP_SCORE: {
    threshold: 'plan.challenges.threshold.sleep',
    required: 'plan.challenges.required.sleep',
    period: 'plan.challenges.period.sleep',
    condition: 'plan.challenges.condition.sleep',
    duration: 'plan.challenges.duration.sleep',
  },
  DAILY_STEPS: {
    threshold: 'plan.challenges.threshold.steps',
    required: 'plan.challenges.required.steps',
    period: 'plan.challenges.period.steps',
    condition: 'plan.challenges.condition.steps',
    duration: 'plan.challenges.duration.steps',
  },
  WEEKLY_WORKOUTS: {
    threshold: 'plan.challenges.threshold.workouts',
    required: 'plan.challenges.required.workouts',
    period: 'plan.challenges.period.workouts',
    condition: 'plan.challenges.condition.workouts',
    duration: 'plan.challenges.duration.workouts',
  },
};

function statusLabel(status: ChallengeStatus): string {
  switch (status) {
    case 'DRAFT':
      return t('plan.challenges.status.draft');
    case 'ACTIVE':
      return enumLabel('ACTIVE');
    case 'COMPLETED':
      return t('plan.challenges.status.completed');
    default:
      return t('plan.challenges.status.failed');
  }
}

const STATUS_BADGE_STYLE: Record<ChallengeStatus, { backgroundColor: string; color: string }> = {
  DRAFT: { backgroundColor: colors.muted.default, color: colors.muted.foreground },
  ACTIVE: { backgroundColor: colors.primary.default, color: colors.primary.foreground },
  COMPLETED: { backgroundColor: '#E8F5EE', color: colors.success },
  FAILED: { backgroundColor: '#FBEAE9', color: colors.danger },
};

function describeTerms(c: Pick<Challenge, 'type' | 'requiredCount' | 'threshold' | 'windowDays'>): string {
  const keys = TYPE_KEYS[c.type];
  return t('plan.challenges.terms', {
    condition: t(keys.condition, { count: c.threshold }),
    duration: t(keys.duration, { count: c.requiredCount }),
    window: t('plan.challenges.window', { count: c.windowDays }),
  });
}

function progressSummary(c: Challenge): string {
  const period = t(TYPE_KEYS[c.type].period);
  const { status, currentCount, requiredCount, daysRemaining } = c.progress;
  const params = { current: currentCount, required: requiredCount, period };
  if (status === 'DRAFT') return t('plan.challenges.progress.draft');
  if (status === 'ACTIVE') {
    if (daysRemaining === null) return t('plan.challenges.progress.activeOpen', params);
    return t('plan.challenges.progress.active', { ...params, left: t('plan.challenges.daysLeft', { count: daysRemaining }) });
  }
  if (status === 'COMPLETED') return t('plan.challenges.progress.completed', params);
  return t('plan.challenges.progress.failed', params);
}

interface ChallengeFormState {
  type: ChallengeType;
  name: string;
  requiredCount: string;
  threshold: string;
  windowDays: string;
}

const EMPTY_FORM: ChallengeFormState = { type: 'SLEEP_SCORE', name: '', requiredCount: '', threshold: '', windowDays: '' };

function challengeToFormState(challenge: Challenge): ChallengeFormState {
  return {
    type: challenge.type,
    name: challenge.name ?? '',
    requiredCount: String(challenge.requiredCount),
    threshold: String(challenge.threshold),
    windowDays: String(challenge.windowDays),
  };
}

function ProgressBar({ current, required }: { current: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

function ChallengeForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ChallengeFormState;
  onCancel?: () => void;
  onSaved: (data: CreateChallengeInput) => Promise<void>;
}) {
  const { t, language } = useT();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const keys = TYPE_KEYS[form.type];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const typeOptions: ChipOption[] = useMemo(() => ChallengeTypeEnum.options.map((v) => ({ value: v, label: enumLabel(v) })), [language]);

  async function submit() {
    const parsed = CreateChallengeSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, tDynamic(v?.[0] ?? '')])));
      return;
    }
    setErrors({});
    setServerError(null);
    setSubmitting(true);
    try {
      await onSaved(parsed.data);
    } catch {
      setServerError(t('plan.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={styles.formCard}>
      {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}

      <ChipSingleSelect
        label={t('plan.challenges.type')}
        options={typeOptions}
        value={form.type}
        onChange={(v) => setForm({ ...form, type: v as ChallengeType })}
      />
      <TextField label={t('plan.challenges.nameOptional')} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      <TextField
        label={t(keys.threshold)}
        keyboardType="numeric"
        value={form.threshold}
        onChangeText={(v) => setForm({ ...form, threshold: v })}
        error={errors.threshold}
      />
      <TextField
        label={t(keys.required)}
        keyboardType="numeric"
        value={form.requiredCount}
        onChangeText={(v) => setForm({ ...form, requiredCount: v })}
        error={errors.requiredCount}
      />
      <TextField
        label={t('plan.challenges.length')}
        keyboardType="numeric"
        value={form.windowDays}
        onChangeText={(v) => setForm({ ...form, windowDays: v })}
        error={errors.windowDays}
      />

      <View style={styles.row}>
        <Button title={submitting ? t('common.saving') : t('common.save')} size="sm" onPress={submit} loading={submitting} style={styles.flex1} />
        {onCancel ? <Button title={t('common.cancel')} size="sm" variant="outline" onPress={onCancel} style={styles.flex1} /> : null}
      </View>
    </Card>
  );
}

function ChallengeRow({
  challenge,
  canPublish,
  onUpdated,
  onDeleted,
}: {
  challenge: Challenge;
  canPublish: boolean;
  onUpdated: (c: Challenge) => void;
  onDeleted: () => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const { status } = challenge.progress;
  const isDraft = status === 'DRAFT';
  const badgeStyle = STATUS_BADGE_STYLE[status];

  async function handleSave(data: CreateChallengeInput) {
    const updated = await updateChallengeTerms(challenge.id, data);
    onUpdated(updated);
    setEditing(false);
  }

  async function handleActivate() {
    setActivating(true);
    try {
      onUpdated(await activateChallenge(challenge.id));
    } catch {
      setActivating(false);
    }
  }

  async function handleToggleVisibility() {
    setTogglingVisibility(true);
    try {
      onUpdated(await setChallengeVisibility(challenge.id, challenge.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'));
    } finally {
      setTogglingVisibility(false);
    }
  }

  async function handleDelete() {
    if (!(await confirmDestructive(
        t('plan.deleteTitle', { name: challenge.name || enumLabel(challenge.type) }),
        t('plan.challenges.deleteMessage'),
      ))) return;
    setDeleting(true);
    try {
      await deleteChallenge(challenge.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <ChallengeForm initial={challengeToFormState(challenge)} onCancel={() => setEditing(false)} onSaved={handleSave} />
    );
  }

  return (
    <Card>
      <View style={styles.badgeRow}>
        <Text style={styles.rowTitle}>{challenge.name || enumLabel(challenge.type)}</Text>
        <View style={[styles.badge, { backgroundColor: badgeStyle.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: badgeStyle.color }]}>{statusLabel(status)}</Text>
        </View>
        {challenge.visibility === 'PUBLIC' ? (
          <View style={styles.publicBadge}>
            <Text style={styles.publicBadgeText}>{enumLabel('PUBLIC')}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.rowSubtitle}>{describeTerms(challenge)}</Text>
      {!isDraft ? (
        <View style={styles.progressBlock}>
          <ProgressBar current={challenge.progress.currentCount} required={challenge.progress.requiredCount} />
          <Text style={styles.rowSubtitle}>{progressSummary(challenge)}</Text>
        </View>
      ) : null}

      <View style={styles.actionsStack}>
        {isDraft ? (
          <Button title={activating ? t('plan.challenges.starting') : t('plan.challenges.start')} size="sm" onPress={handleActivate} loading={activating} />
        ) : null}
        {canPublish ? (
          <Button
            title={togglingVisibility ? t('account.creator.updating') : challenge.visibility === 'PUBLIC' ? t('plan.makePrivate') : t('plan.publishPublicly')}
            size="sm"
            variant="outline"
            onPress={handleToggleVisibility}
            loading={togglingVisibility}
          />
        ) : null}
        <View style={styles.row}>
          {isDraft ? <Button title={t('common.edit')} size="sm" variant="outline" onPress={() => setEditing(true)} style={styles.flex1} /> : null}
          <Button title={deleting ? t('plan.deleting') : t('common.delete')} size="sm" variant="destructive" onPress={handleDelete} loading={deleting} style={styles.flex1} />
        </View>
      </View>
    </Card>
  );
}

export default function ChallengesScreen() {
  const { t } = useT();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    Promise.all([listChallenges(), getPublicProfileStatus().catch(() => ({ canPublish: false, accountType: 'MEMBER' as const }))])
      .then(([list, status]) => {
        setChallenges(list);
        setCanPublish(status.canPublish);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  async function handleCreate(data: CreateChallengeInput) {
    const created = await createChallenge(data);
    setChallenges((prev) => [created, ...(prev ?? [])]);
    setAdding(false);
  }

  if (!challenges) {
    return (
      <View style={styles.centered}>
        {loadFailed ? <Alert variant="destructive">{t('plan.challenges.loadFailed')}</Alert> : <ActivityIndicator color={colors.primary.default} />}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {adding ? (
        <ChallengeForm initial={EMPTY_FORM} onCancel={() => setAdding(false)} onSaved={handleCreate} />
      ) : (
        <Button title={t('plan.challenges.add')} size="sm" onPress={() => setAdding(true)} />
      )}

      {challenges.length === 0 && !adding ? <Text style={styles.empty}>{t('plan.challenges.empty')}</Text> : null}

      {challenges.map((challenge) => (
        <ChallengeRow
          key={challenge.id}
          challenge={challenge}
          canPublish={canPublish}
          onUpdated={(updated) => setChallenges((prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)))}
          onDeleted={() => setChallenges((prev) => (prev ?? []).filter((c) => c.id !== challenge.id))}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: screenBackground,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  centered: {
    flex: 1,
    backgroundColor: screenBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  formCard: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 15,
    color: colors.foreground,
  },
  rowSubtitle: {
    marginTop: 4,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 11,
  },
  publicBadge: {
    backgroundColor: '#E8F5EE',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  publicBadgeText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 11,
    color: colors.success,
  },
  progressBlock: {
    marginTop: 8,
    gap: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.muted.default,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary.default,
  },
  actionsStack: {
    marginTop: 10,
    gap: 8,
  },
  empty: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
});

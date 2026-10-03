import { useEffect, useState } from 'react';
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
import { colors, fontFamily } from '@/src/theme/tokens';
import { ChallengeTypeEnum, CreateChallengeSchema, type CreateChallengeInput } from '@/src/validation/schemas';

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

// TYPE_META must be declared before TYPE_OPTIONS below: TYPE_OPTIONS's
// initializer runs immediately at module load and calls TYPE_META_LABEL,
// which reads TYPE_META — if TYPE_META were declared later as a const, that
// read would hit its temporal dead zone and throw "Cannot access 'TYPE_META'
// before initialization" (function hoisting makes TYPE_META_LABEL itself
// callable early, but it can't rescue a const it closes over that hasn't
// run yet).
const TYPE_META: Record<ChallengeType, { label: string; periodNoun: string; thresholdLabel: string; thresholdUnit: string }> = {
  SLEEP_SCORE: { label: 'Sleep score', periodNoun: 'nights', thresholdLabel: 'Sleep score above', thresholdUnit: 'points' },
  DAILY_STEPS: { label: 'Daily steps', periodNoun: 'days', thresholdLabel: 'Steps above', thresholdUnit: 'steps' },
  WEEKLY_WORKOUTS: { label: 'Weekly workouts', periodNoun: 'weeks', thresholdLabel: 'Workouts above', thresholdUnit: 'per week' },
};

function TYPE_META_LABEL(type: string): string {
  return TYPE_META[type as ChallengeType]?.label ?? type;
}

const TYPE_OPTIONS: ChipOption[] = ChallengeTypeEnum.options.map((v) => ({ value: v, label: TYPE_META_LABEL(v) }));

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const STATUS_BADGE_STYLE: Record<ChallengeStatus, { backgroundColor: string; color: string }> = {
  DRAFT: { backgroundColor: colors.muted.default, color: colors.muted.foreground },
  ACTIVE: { backgroundColor: colors.primary.default, color: colors.primary.foreground },
  COMPLETED: { backgroundColor: '#E8F5EE', color: colors.success },
  FAILED: { backgroundColor: '#FBEAE9', color: colors.danger },
};

function describeTerms(c: Pick<Challenge, 'type' | 'requiredCount' | 'threshold' | 'windowDays'>): string {
  const meta = TYPE_META[c.type];
  return `${meta.thresholdLabel} ${c.threshold} ${meta.thresholdUnit}, for ${c.requiredCount} ${meta.periodNoun}, within ${c.windowDays} days of activation`;
}

function progressSummary(c: Challenge): string {
  const meta = TYPE_META[c.type];
  const { status, currentCount, requiredCount, daysRemaining } = c.progress;
  if (status === 'DRAFT') return 'Not started yet.';
  if (status === 'ACTIVE') {
    return `${currentCount}/${requiredCount} ${meta.periodNoun} so far · ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;
  }
  if (status === 'COMPLETED') return `${currentCount}/${requiredCount} ${meta.periodNoun} reached.`;
  return `Only ${currentCount}/${requiredCount} ${meta.periodNoun} reached before the deadline.`;
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
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const meta = TYPE_META[form.type];

  async function submit() {
    const parsed = CreateChallengeSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])));
      return;
    }
    setErrors({});
    setServerError(null);
    setSubmitting(true);
    try {
      await onSaved(parsed.data);
    } catch {
      setServerError('Could not save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={styles.formCard}>
      {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}

      <ChipSingleSelect
        label="Challenge type"
        options={TYPE_OPTIONS}
        value={form.type}
        onChange={(v) => setForm({ ...form, type: v as ChallengeType })}
      />
      <TextField label="Name (optional)" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      <TextField
        label={`${meta.thresholdLabel} (${meta.thresholdUnit})`}
        keyboardType="numeric"
        value={form.threshold}
        onChangeText={(v) => setForm({ ...form, threshold: v })}
        error={errors.threshold}
      />
      <TextField
        label={`Number of ${meta.periodNoun} to hit`}
        keyboardType="numeric"
        value={form.requiredCount}
        onChangeText={(v) => setForm({ ...form, requiredCount: v })}
        error={errors.requiredCount}
      />
      <TextField
        label="Challenge length (days)"
        keyboardType="numeric"
        value={form.windowDays}
        onChangeText={(v) => setForm({ ...form, windowDays: v })}
        error={errors.windowDays}
      />

      <View style={styles.row}>
        <Button title={submitting ? 'Saving…' : 'Save'} size="sm" onPress={submit} loading={submitting} style={styles.flex1} />
        {onCancel ? <Button title="Cancel" size="sm" variant="outline" onPress={onCancel} style={styles.flex1} /> : null}
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
        <Text style={styles.rowTitle}>{challenge.name || TYPE_META[challenge.type].label}</Text>
        <View style={[styles.badge, { backgroundColor: badgeStyle.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: badgeStyle.color }]}>{STATUS_LABEL[status]}</Text>
        </View>
        {challenge.visibility === 'PUBLIC' ? (
          <View style={styles.publicBadge}>
            <Text style={styles.publicBadgeText}>Public</Text>
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
          <Button title={activating ? 'Starting…' : 'Start challenge'} size="sm" onPress={handleActivate} loading={activating} />
        ) : null}
        {canPublish ? (
          <Button
            title={togglingVisibility ? 'Updating…' : challenge.visibility === 'PUBLIC' ? 'Make private' : 'Publish publicly'}
            size="sm"
            variant="outline"
            onPress={handleToggleVisibility}
            loading={togglingVisibility}
          />
        ) : null}
        <View style={styles.row}>
          {isDraft ? <Button title="Edit" size="sm" variant="outline" onPress={() => setEditing(true)} style={styles.flex1} /> : null}
          <Button title={deleting ? 'Deleting…' : 'Delete'} size="sm" variant="destructive" onPress={handleDelete} loading={deleting} style={styles.flex1} />
        </View>
      </View>
    </Card>
  );
}

export default function ChallengesScreen() {
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listChallenges(), getPublicProfileStatus().catch(() => ({ canPublish: false, accountType: 'MEMBER' as const }))])
      .then(([list, status]) => {
        setChallenges(list);
        setCanPublish(status.canPublish);
      })
      .catch(() => setError('Could not load your challenges.'));
  }, []);

  async function handleCreate(data: CreateChallengeInput) {
    const created = await createChallenge(data);
    setChallenges((prev) => [created, ...(prev ?? [])]);
    setAdding(false);
  }

  if (!challenges) {
    return (
      <View style={styles.centered}>
        {error ? <Alert variant="destructive">{error}</Alert> : <ActivityIndicator color={colors.primary.default} />}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {adding ? (
        <ChallengeForm initial={EMPTY_FORM} onCancel={() => setAdding(false)} onSaved={handleCreate} />
      ) : (
        <Button title="Add challenge" size="sm" onPress={() => setAdding(true)} />
      )}

      {challenges.length === 0 && !adding ? <Text style={styles.empty}>No challenges yet.</Text> : null}

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
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
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

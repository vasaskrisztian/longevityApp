import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createProtocol, deleteProtocol, listProtocols, updateProtocol, type Protocol } from '@/src/api/protocols';
import { getPublicProfileStatus } from '@/src/api/creators';
import { listGoals, type Goal } from '@/src/api/goals';
import { listSupplements, type Supplement } from '@/src/api/supplements';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipMultiSelect } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { GoalsPanel } from '@/src/screens/GoalsPanel';
import { describeSupplement } from '@/src/screens/supplementText';
import { confirmDestructive } from '@/src/utils/confirm';
import { colors, fontFamily } from '@/src/theme/tokens';
import { CreateProtocolSchema, type CreateProtocolInput } from '@/src/validation/schemas';

/**
 * Plan > Protocols and goals: list + inline add/edit form (name, description,
 * 4 numeric targets, supplements picked from the user's own list) + delete +
 * "Set as active" + (for a consenting creator) Publish/Make private. Each
 * protocol shows its goals underneath (add / edit / delete in place); goals
 * without a protocol have their own section at the bottom.
 */

interface ProtocolFormState {
  name: string;
  description: string;
  targetSleepScore: string;
  targetSleepMinutes: string;
  targetWeeklyWorkouts: string;
  targetDailyActiveCalories: string;
  supplementIds: string[];
}

const EMPTY_FORM: ProtocolFormState = {
  name: '',
  description: '',
  targetSleepScore: '',
  targetSleepMinutes: '',
  targetWeeklyWorkouts: '',
  targetDailyActiveCalories: '',
  supplementIds: [],
};

function protocolToFormState(protocol: Protocol): ProtocolFormState {
  return {
    name: protocol.name,
    description: protocol.description ?? '',
    targetSleepScore: protocol.targetSleepScore != null ? String(protocol.targetSleepScore) : '',
    targetSleepMinutes: protocol.targetSleepMinutes != null ? String(protocol.targetSleepMinutes) : '',
    targetWeeklyWorkouts: protocol.targetWeeklyWorkouts != null ? String(protocol.targetWeeklyWorkouts) : '',
    targetDailyActiveCalories:
      protocol.targetDailyActiveCalories != null ? String(protocol.targetDailyActiveCalories) : '',
    supplementIds: protocol.supplements.map((s) => s.supplementId).filter((id): id is string => id !== null),
  };
}

function formatMinutes(totalMinutes: number | null): string | null {
  if (totalMinutes === null) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function ProtocolForm({
  initial,
  supplements,
  onCancel,
  onSaved,
}: {
  initial: ProtocolFormState;
  /** The user's own supplement list — what a protocol can pick from. */
  supplements: Supplement[];
  onCancel?: () => void;
  onSaved: (data: CreateProtocolInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const parsed = CreateProtocolSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? '']),
        ),
      );
      return;
    }
    setFieldErrors({});
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

      <TextField label="Protocol name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} error={fieldErrors.name} />
      <TextField
        label="Description (optional)"
        value={form.description}
        onChangeText={(v) => setForm({ ...form, description: v })}
      />

      <Text style={styles.sectionLabel}>Targets</Text>
      <View style={styles.row}>
        <TextField
          label="Sleep score (0–100)"
          keyboardType="numeric"
          style={styles.flex1}
          value={form.targetSleepScore}
          onChangeText={(v) => setForm({ ...form, targetSleepScore: v })}
          error={fieldErrors.targetSleepScore}
        />
        <TextField
          label="Sleep duration (min)"
          keyboardType="numeric"
          style={styles.flex1}
          value={form.targetSleepMinutes}
          onChangeText={(v) => setForm({ ...form, targetSleepMinutes: v })}
          error={fieldErrors.targetSleepMinutes}
        />
      </View>
      <View style={styles.row}>
        <TextField
          label="Workouts / week"
          keyboardType="numeric"
          style={styles.flex1}
          value={form.targetWeeklyWorkouts}
          onChangeText={(v) => setForm({ ...form, targetWeeklyWorkouts: v })}
          error={fieldErrors.targetWeeklyWorkouts}
        />
        <TextField
          label="Active kcal / day"
          keyboardType="numeric"
          style={styles.flex1}
          value={form.targetDailyActiveCalories}
          onChangeText={(v) => setForm({ ...form, targetDailyActiveCalories: v })}
          error={fieldErrors.targetDailyActiveCalories}
        />
      </View>

      <Text style={styles.sectionLabel}>Supplements</Text>
      {supplements.length === 0 ? (
        <Text style={styles.empty}>Your supplement list is empty. Add what you take there, then pick it here.</Text>
      ) : (
        <ChipMultiSelect
          label="Part of this protocol"
          options={supplements.map((s) => ({ value: s.id, label: s.name }))}
          values={form.supplementIds}
          onChange={(supplementIds) => setForm({ ...form, supplementIds })}
        />
      )}
      <Button title="Manage my supplements" size="sm" variant="outline" onPress={() => router.push('/plan/supplements')} />

      <View style={styles.row}>
        <Button title={submitting ? 'Saving…' : 'Save'} size="sm" onPress={submit} loading={submitting} style={styles.flex1} />
        {onCancel ? <Button title="Cancel" size="sm" variant="outline" onPress={onCancel} style={styles.flex1} /> : null}
      </View>
    </Card>
  );
}

function ProtocolRow({
  protocol,
  supplements,
  goals,
  canPublish,
  onUpdated,
  onDeleted,
  onActivated,
  onGoalCreated,
  onGoalUpdated,
  onGoalDeleted,
}: {
  protocol: Protocol;
  supplements: Supplement[];
  goals: Goal[];
  canPublish: boolean;
  onUpdated: (p: Protocol) => void;
  onDeleted: () => void;
  onActivated: (id: string) => void;
  onGoalCreated: (goal: Goal) => void;
  onGoalUpdated: (goal: Goal) => void;
  onGoalDeleted: (goalId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  async function handleSave(data: CreateProtocolInput) {
    const updated = await updateProtocol(protocol.id, data);
    onUpdated(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!(await confirmDestructive(`Delete "${protocol.name}"?`, 'This protocol will be permanently deleted. This cannot be undone.'))) return;
    setDeleting(true);
    try {
      await deleteProtocol(protocol.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      const updated = await updateProtocol(protocol.id, { isActive: true });
      onUpdated(updated);
      onActivated(protocol.id);
    } catch {
      setActivating(false);
    }
  }

  async function handleToggleVisibility() {
    setTogglingVisibility(true);
    try {
      const updated = await updateProtocol(protocol.id, {
        visibility: protocol.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC',
      });
      onUpdated(updated);
    } finally {
      setTogglingVisibility(false);
    }
  }

  if (editing) {
    return (
      <ProtocolForm
        initial={protocolToFormState(protocol)}
        supplements={supplements}
        onCancel={() => setEditing(false)}
        onSaved={handleSave}
      />
    );
  }

  const targets = [
    protocol.targetSleepScore != null ? `Sleep score ≥ ${protocol.targetSleepScore}` : null,
    formatMinutes(protocol.targetSleepMinutes) ? `Sleep ${formatMinutes(protocol.targetSleepMinutes)}` : null,
    protocol.targetWeeklyWorkouts != null ? `${protocol.targetWeeklyWorkouts} workouts/week` : null,
    protocol.targetDailyActiveCalories != null ? `${protocol.targetDailyActiveCalories} active kcal/day` : null,
  ].filter(Boolean);

  return (
    <Card style={protocol.isActive ? styles.activeCard : undefined}>
      <View style={styles.badgeRow}>
        <Text style={styles.rowTitle}>{protocol.name}</Text>
        {protocol.isActive ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        ) : null}
        {protocol.visibility === 'PUBLIC' ? (
          <View style={styles.publicBadge}>
            <Text style={styles.publicBadgeText}>Public</Text>
          </View>
        ) : null}
      </View>
      {protocol.description ? <Text style={styles.rowSubtitle}>{protocol.description}</Text> : null}
      {targets.length > 0 ? <Text style={styles.rowSubtitle}>{targets.join(' · ')}</Text> : null}
      {protocol.supplements.length > 0 ? (
        <View style={styles.supplementList}>
          <Text style={styles.rowSubtitle}>Supplements</Text>
          {protocol.supplements.map((s, i) => (
            <Text key={`${s.supplementId ?? s.name}-${i}`} style={styles.rowSubtitle}>
              • {s.name}
              {describeSupplement(s) ? ` — ${describeSupplement(s)}` : ''}
            </Text>
          ))}
        </View>
      ) : null}


      <View style={styles.actionsStack}>
        {!protocol.isActive ? (
          <Button title={activating ? 'Setting…' : 'Set as active'} size="sm" onPress={handleActivate} loading={activating} />
        ) : null}
        {canPublish ? (
          <Button
            title={togglingVisibility ? 'Updating…' : protocol.visibility === 'PUBLIC' ? 'Make private' : 'Publish publicly'}
            size="sm"
            variant="outline"
            onPress={handleToggleVisibility}
            loading={togglingVisibility}
          />
        ) : null}
        <View style={styles.row}>
          <Button title="Edit" size="sm" variant="outline" onPress={() => setEditing(true)} style={styles.flex1} />
          <Button title={deleting ? 'Deleting…' : 'Delete'} size="sm" variant="destructive" onPress={handleDelete} loading={deleting} style={styles.flex1} />
        </View>
      </View>

      <View style={styles.goalsBlock}>
        <GoalsPanel
          title="Goals of this protocol"
          goals={goals}
          protocolId={protocol.id}
          onCreated={onGoalCreated}
          onUpdated={onGoalUpdated}
          onDeleted={onGoalDeleted}
        />
      </View>
    </Card>
  );
}

export default function ProtocolsScreen() {
  const [protocols, setProtocols] = useState<Protocol[] | null>(null);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listProtocols(),
      listSupplements(),
      listGoals(),
      getPublicProfileStatus().catch(() => ({ canPublish: false, accountType: 'MEMBER' as const })),
    ])
      .then(([list, ownSupplements, ownGoals, status]) => {
        setProtocols(list);
        setSupplements(ownSupplements);
        setGoals(ownGoals);
        setCanPublish(status.canPublish);
      })
      .catch(() => setError('Could not load your protocols.'));
  }, []);

  async function handleCreate(data: CreateProtocolInput) {
    const created = await createProtocol(data);
    setProtocols((prev) => [created, ...(prev ?? [])]);
    setAdding(false);
  }

  const addGoal = (goal: Goal) => setGoals((prev) => [goal, ...prev]);
  const replaceGoal = (goal: Goal) => setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
  const removeGoal = (goalId: string) => setGoals((prev) => prev.filter((g) => g.id !== goalId));
  const goalsWithoutProtocol = goals.filter((g) => g.protocolId === null || !protocols?.some((p) => p.id === g.protocolId));

  if (!protocols) {
    return (
      <View style={styles.centered}>
        {error ? <Alert variant="destructive">{error}</Alert> : <ActivityIndicator color={colors.primary.default} />}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {adding ? (
        <ProtocolForm initial={EMPTY_FORM} supplements={supplements} onCancel={() => setAdding(false)} onSaved={handleCreate} />
      ) : (
        <Button title="Add protocol" size="sm" onPress={() => setAdding(true)} />
      )}

      {protocols.length === 0 && !adding ? <Text style={styles.empty}>No protocols yet.</Text> : null}

      {protocols.map((protocol) => (
        <ProtocolRow
          key={protocol.id}
          protocol={protocol}
          supplements={supplements}
          goals={goals.filter((g) => g.protocolId === protocol.id)}
          canPublish={canPublish}
          onGoalCreated={addGoal}
          onGoalUpdated={replaceGoal}
          onGoalDeleted={removeGoal}
          onUpdated={(updated) => setProtocols((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)))}
          onDeleted={() => {
            setProtocols((prev) => (prev ?? []).filter((p) => p.id !== protocol.id));
            // The server keeps the goals of a deleted protocol (without a protocol).
            setGoals((prev) => prev.map((g) => (g.protocolId === protocol.id ? { ...g, protocolId: null } : g)));
          }}
          onActivated={(id) =>
            setProtocols((prev) => (prev ?? []).map((p) => ({ ...p, isActive: p.id === id })))
          }
        />
      ))}

      {goalsWithoutProtocol.length > 0 || protocols.length === 0 ? (
        <Card>
          <GoalsPanel
            title="Goals without a protocol"
            goals={goalsWithoutProtocol}
            protocolId={null}
            onCreated={addGoal}
            onUpdated={replaceGoal}
            onDeleted={removeGoal}
          />
        </Card>
      ) : null}
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
  supplementList: {
    marginTop: 4,
  },
  goalsBlock: {
    marginTop: 12,
  },
  sectionLabel: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    color: colors.foreground,
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
  activeCard: {
    borderColor: colors.primary.default,
  },
  activeBadge: {
    backgroundColor: colors.primary.default,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  activeBadgeText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 11,
    color: colors.primary.foreground,
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

import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ZodIssue } from 'zod';

import { createProtocol, deleteProtocol, listProtocols, updateProtocol, type Protocol } from '@/src/api/protocols';
import { getPublicProfileStatus } from '@/src/api/creators';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { colors, fontFamily } from '@/src/theme/tokens';
import {
  CreateProtocolSchema,
  SupplementFrequencyEnum,
  SupplementTimingEnum,
  enumLabel,
  type CreateProtocolInput,
} from '@/src/validation/schemas';

/**
 * Mirrors the web app's profile/protocols/protocols-manager.tsx: list +
 * inline add/edit form (name, description, 4 numeric targets, a dynamic
 * supplement sub-form) + delete + "Set as active" + (for a consenting
 * creator) a Publish/Make-private toggle. React Native has no
 * react-hook-form useFieldArray equivalent in this codebase's established
 * pattern (every other mobile form here is plain useState + Zod
 * .safeParse(), not react-hook-form — see supplements.tsx) — the
 * supplement rows are just a plain array in component state instead.
 */

const FREQUENCY_OPTIONS: ChipOption[] = SupplementFrequencyEnum.options.map((v) => ({
  value: v,
  label: enumLabel(v),
}));
const TIMING_OPTIONS: ChipOption[] = SupplementTimingEnum.options.map((v) => ({
  value: v,
  label: enumLabel(v),
}));

interface SupplementRowState {
  name: string;
  dosage: string;
  unit: string;
  frequency: string | undefined;
  timing: string | undefined;
}

interface ProtocolFormState {
  name: string;
  description: string;
  targetSleepScore: string;
  targetSleepMinutes: string;
  targetWeeklyWorkouts: string;
  targetDailyActiveCalories: string;
  supplements: SupplementRowState[];
}

const EMPTY_SUPPLEMENT: SupplementRowState = { name: '', dosage: '', unit: '', frequency: undefined, timing: undefined };

const EMPTY_FORM: ProtocolFormState = {
  name: '',
  description: '',
  targetSleepScore: '',
  targetSleepMinutes: '',
  targetWeeklyWorkouts: '',
  targetDailyActiveCalories: '',
  supplements: [],
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
    supplements: protocol.supplements.map((s) => ({
      name: s.name,
      dosage: s.dosage != null ? String(s.dosage) : '',
      unit: s.unit ?? '',
      frequency: s.frequency ?? undefined,
      timing: s.timing ?? undefined,
    })),
  };
}

function formatMinutes(totalMinutes: number | null): string | null {
  if (totalMinutes === null) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function supplementIssue(issues: ZodIssue[], index: number, field: string): string | undefined {
  return issues.find((i) => i.path[0] === 'supplements' && i.path[1] === index && i.path[2] === field)?.message;
}

function ProtocolForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ProtocolFormState;
  onCancel?: () => void;
  onSaved: (data: CreateProtocolInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<ZodIssue[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateSupplement(index: number, patch: Partial<SupplementRowState>) {
    setForm((f) => ({
      ...f,
      supplements: f.supplements.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function removeSupplement(index: number) {
    setForm((f) => ({ ...f, supplements: f.supplements.filter((_, i) => i !== index) }));
  }

  async function submit() {
    const parsed = CreateProtocolSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? '']),
        ),
      );
      setIssues(parsed.error.issues);
      return;
    }
    setFieldErrors({});
    setIssues([]);
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

      <View style={styles.supplementsHeader}>
        <Text style={styles.sectionLabel}>Supplements</Text>
        <Button
          title="Add supplement"
          size="sm"
          variant="outline"
          onPress={() => setForm((f) => ({ ...f, supplements: [...f.supplements, { ...EMPTY_SUPPLEMENT }] }))}
        />
      </View>
      {form.supplements.length === 0 ? <Text style={styles.empty}>No supplements added.</Text> : null}
      {form.supplements.map((supplement, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <Card key={index} style={styles.supplementCard}>
          <TextField
            label="Name"
            value={supplement.name}
            onChangeText={(v) => updateSupplement(index, { name: v })}
            error={supplementIssue(issues, index, 'name')}
          />
          <View style={styles.row}>
            <TextField
              label="Dosage"
              keyboardType="numeric"
              style={styles.flex1}
              value={supplement.dosage}
              onChangeText={(v) => updateSupplement(index, { dosage: v })}
              error={supplementIssue(issues, index, 'dosage')}
            />
            <TextField
              label="Unit"
              style={styles.flex1}
              value={supplement.unit}
              onChangeText={(v) => updateSupplement(index, { unit: v })}
            />
          </View>
          <ChipSingleSelect
            label="Frequency"
            options={FREQUENCY_OPTIONS}
            value={supplement.frequency}
            onChange={(v) => updateSupplement(index, { frequency: v })}
          />
          <ChipSingleSelect
            label="Timing"
            options={TIMING_OPTIONS}
            value={supplement.timing}
            onChange={(v) => updateSupplement(index, { timing: v })}
          />
          <Button title="Remove supplement" size="sm" variant="destructive" onPress={() => removeSupplement(index)} />
        </Card>
      ))}

      <View style={styles.row}>
        <Button title={submitting ? 'Saving…' : 'Save'} size="sm" onPress={submit} loading={submitting} style={styles.flex1} />
        {onCancel ? <Button title="Cancel" size="sm" variant="outline" onPress={onCancel} style={styles.flex1} /> : null}
      </View>
    </Card>
  );
}

function ProtocolRow({
  protocol,
  canPublish,
  onUpdated,
  onDeleted,
  onActivated,
}: {
  protocol: Protocol;
  canPublish: boolean;
  onUpdated: (p: Protocol) => void;
  onDeleted: () => void;
  onActivated: (id: string) => void;
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
      <ProtocolForm initial={protocolToFormState(protocol)} onCancel={() => setEditing(false)} onSaved={handleSave} />
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
        <Text style={styles.rowSubtitle}>Supplements: {protocol.supplements.map((s) => s.name).join(', ')}</Text>
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
    </Card>
  );
}

export default function ProtocolsScreen() {
  const [protocols, setProtocols] = useState<Protocol[] | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listProtocols(), getPublicProfileStatus().catch(() => ({ canPublish: false, accountType: 'MEMBER' as const }))])
      .then(([list, status]) => {
        setProtocols(list);
        setCanPublish(status.canPublish);
      })
      .catch(() => setError('Could not load your protocols.'));
  }, []);

  async function handleCreate(data: CreateProtocolInput) {
    const created = await createProtocol(data);
    setProtocols((prev) => [created, ...(prev ?? [])]);
    setAdding(false);
  }

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
        <ProtocolForm initial={EMPTY_FORM} onCancel={() => setAdding(false)} onSaved={handleCreate} />
      ) : (
        <Button title="Add protocol" size="sm" onPress={() => setAdding(true)} />
      )}

      {protocols.length === 0 && !adding ? <Text style={styles.empty}>No protocols yet.</Text> : null}

      {protocols.map((protocol) => (
        <ProtocolRow
          key={protocol.id}
          protocol={protocol}
          canPublish={canPublish}
          onUpdated={(updated) => setProtocols((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)))}
          onDeleted={() => setProtocols((prev) => (prev ?? []).filter((p) => p.id !== protocol.id))}
          onActivated={(id) =>
            setProtocols((prev) => (prev ?? []).map((p) => ({ ...p, isActive: p.id === id })))
          }
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
  supplementCard: {
    gap: 10,
  },
  supplementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

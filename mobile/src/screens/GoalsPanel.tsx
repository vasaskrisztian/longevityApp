import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { createGoal, deleteGoal, updateGoal, type Goal } from '@/src/api/goals';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { tDynamic, useT } from '@/src/i18n';
import { confirmDestructive } from '@/src/utils/confirm';
import { colors, fontFamily } from '@/src/theme/tokens';
import { CreateGoalSchema, GoalStatusEnum, GoalTypeEnum, enumLabel, type CreateGoalInput } from '@/src/validation/schemas';

/**
 * Goals of one protocol (or the ones without a protocol): list + inline add /
 * edit form + delete. Used inside Plan > Protocols — goals no longer have a
 * screen of their own. The parent owns the goal list; this reports changes.
 */

// Built at render time (not module scope) so the labels follow the language.
const enumOptions = (values: readonly string[]): ChipOption[] => values.map((v) => ({ value: v, label: enumLabel(v) }));

interface GoalFormState {
  type: string;
  name: string;
  description: string;
  targetValue: string;
  targetUnit: string;
  targetDate: string;
  status: string;
}

const EMPTY_FORM: GoalFormState = {
  type: 'GENERAL_HEALTH',
  name: '',
  description: '',
  targetValue: '',
  targetUnit: '',
  targetDate: '',
  status: 'ACTIVE',
};

function goalToFormState(goal: Goal): GoalFormState {
  return {
    type: goal.type,
    name: goal.name,
    description: goal.description ?? '',
    targetValue: goal.targetValue != null ? String(goal.targetValue) : '',
    targetUnit: goal.targetUnit ?? '',
    targetDate: goal.targetDate ?? '',
    status: goal.status,
  };
}

function GoalForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: GoalFormState;
  onCancel?: () => void;
  onSaved: (data: CreateGoalInput) => Promise<void>;
}) {
  const { t, language } = useT();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /* eslint-disable react-hooks/exhaustive-deps */
  const typeOptions = useMemo(() => enumOptions(GoalTypeEnum.options), [language]);
  const statusOptions = useMemo(() => enumOptions(GoalStatusEnum.options), [language]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function submit() {
    const parsed = CreateGoalSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, tDynamic(v?.[0] ?? '')]),
      ));
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
      <TextField label={t('plan.field.name')} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} error={errors.name} />
      <ChipSingleSelect label={t('plan.goals.type')} options={typeOptions} value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
      <View style={styles.row}>
        <TextField
          label={t('plan.goals.targetValue')}
          keyboardType="numeric"
          style={styles.flex1}
          value={form.targetValue}
          onChangeText={(v) => setForm({ ...form, targetValue: v })}
        />
        <TextField
          label={t('plan.goals.unit')}
          style={styles.flex1}
          value={form.targetUnit}
          onChangeText={(v) => setForm({ ...form, targetUnit: v })}
        />
      </View>
      <TextField
        label={t('plan.goals.targetDate')}
        value={form.targetDate}
        onChangeText={(v) => setForm({ ...form, targetDate: v })}
      />
      <ChipSingleSelect label={t('plan.goals.status')} options={statusOptions} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
      <TextField
        label={t('plan.field.descriptionOptional')}
        value={form.description}
        onChangeText={(v) => setForm({ ...form, description: v })}
      />
      <View style={styles.row}>
        <Button title={submitting ? t('common.saving') : t('common.save')} size="sm" onPress={submit} loading={submitting} style={styles.flex1} />
        {onCancel ? <Button title={t('common.cancel')} size="sm" variant="outline" onPress={onCancel} style={styles.flex1} /> : null}
      </View>
    </Card>
  );
}

function GoalRow({ goal, onUpdated, onDeleted }: { goal: Goal; onUpdated: (g: Goal) => void; onDeleted: () => void }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(data: CreateGoalInput) {
    const updated = await updateGoal(goal.id, data);
    onUpdated(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!(await confirmDestructive(t('plan.deleteTitle', { name: goal.name }), t('plan.goals.deleteMessage')))) return;
    setDeleting(true);
    try {
      await deleteGoal(goal.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  if (editing) {
    return <GoalForm initial={goalToFormState(goal)} onCancel={() => setEditing(false)} onSaved={handleSave} />;
  }

  const summary = [
    enumLabel(goal.type),
    enumLabel(goal.status),
    goal.targetValue != null ? t('plan.goals.summaryTarget', { value: `${goal.targetValue}${goal.targetUnit ?? ''}` }) : null,
    goal.targetDate ? t('plan.goals.summaryBy', { date: goal.targetDate }) : null,
  ].filter((part): part is string => part !== null);

  return (
    <Card>
      <Text style={styles.rowTitle}>{goal.name}</Text>
      <Text style={styles.rowSubtitle}>{summary.join(' · ')}</Text>
      <View style={styles.row}>
        <Button title={t('common.edit')} size="sm" variant="outline" onPress={() => setEditing(true)} style={styles.flex1} />
        <Button title={deleting ? t('plan.deleting') : t('common.delete')} size="sm" variant="destructive" onPress={handleDelete} loading={deleting} style={styles.flex1} />
      </View>
    </Card>
  );
}

export function GoalsPanel({
  title,
  goals,
  protocolId,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  title: string;
  goals: Goal[];
  /** Where a goal added here belongs: a protocol, or null for "no protocol". */
  protocolId: string | null;
  onCreated: (goal: Goal) => void;
  onUpdated: (goal: Goal) => void;
  onDeleted: (goalId: string) => void;
}) {
  const { t } = useT();
  const [adding, setAdding] = useState(false);

  async function handleCreate(data: CreateGoalInput) {
    onCreated(await createGoal({ ...data, protocolId }));
    setAdding(false);
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.panelTitle}>{title}</Text>
        {adding ? null : <Button title={t('plan.goals.add')} size="sm" variant="outline" onPress={() => setAdding(true)} />}
      </View>
      {adding ? <GoalForm initial={EMPTY_FORM} onCancel={() => setAdding(false)} onSaved={handleCreate} /> : null}
      {goals.length === 0 && !adding ? <Text style={styles.empty}>{t('plan.goals.empty')}</Text> : null}
      {goals.map((goal) => (
        <GoalRow key={goal.id} goal={goal} onUpdated={onUpdated} onDeleted={() => onDeleted(goal.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  panelTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 15, color: colors.foreground },
  formCard: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  rowTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 15, color: colors.foreground },
  rowSubtitle: { marginTop: 2, marginBottom: 10, fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
  empty: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
});

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  createSupplement,
  deleteSupplement,
  listSupplements,
  updateSupplement,
  type Supplement,
} from '@/src/api/supplements';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { describeSupplement } from '@/src/screens/supplementText';
import { tDynamic, useT } from '@/src/i18n';
import { confirmDestructive } from '@/src/utils/confirm';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import {
  CreateSupplementSchema,
  SupplementFrequencyEnum,
  SupplementTimingEnum,
  enumLabel,
  type CreateSupplementInput,
} from '@/src/validation/schemas';

/** Mirrors the web app's profile/supplements/supplements-manager.tsx: list +
 * inline add/edit form + delete, same structure as goals.tsx (phase 18). */

// Built at render time (not module scope) so the labels follow the language.
const enumOptions = (values: readonly string[]): ChipOption[] => values.map((v) => ({ value: v, label: enumLabel(v) }));

interface SupplementFormState {
  name: string;
  dosage: string;
  unit: string;
  frequency: string;
  timing: string | undefined;
  notes: string;
  active: boolean;
}

const EMPTY_FORM: SupplementFormState = {
  name: '',
  dosage: '',
  unit: '',
  frequency: 'DAILY',
  timing: undefined,
  notes: '',
  active: true,
};

function supplementToFormState(supplement: Supplement): SupplementFormState {
  return {
    name: supplement.name,
    dosage: supplement.dosage != null ? String(supplement.dosage) : '',
    unit: supplement.unit ?? '',
    frequency: supplement.frequency ?? 'DAILY',
    timing: supplement.timing ?? undefined,
    notes: supplement.notes ?? '',
    active: supplement.active,
  };
}

function ActiveToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  useT();
  return (
    <Pressable style={styles.activeRow} onPress={() => onChange(!value)}>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={20}
        color={value ? colors.primary.default : colors.muted.foreground}
      />
      <Text style={styles.activeLabel}>{enumLabel('ACTIVE')}</Text>
    </Pressable>
  );
}

function SupplementForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: SupplementFormState;
  onCancel?: () => void;
  onSaved: (data: CreateSupplementInput) => Promise<void>;
}) {
  const { t, language } = useT();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /* eslint-disable react-hooks/exhaustive-deps */
  const frequencyOptions = useMemo(() => enumOptions(SupplementFrequencyEnum.options), [language]);
  const timingOptions = useMemo(() => enumOptions(SupplementTimingEnum.options), [language]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function submit() {
    const parsed = CreateSupplementSchema.safeParse(form);
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
      <View style={styles.row}>
        <TextField
          label={t('plan.supplements.dosage')}
          keyboardType="numeric"
          style={styles.flex1}
          value={form.dosage}
          onChangeText={(v) => setForm({ ...form, dosage: v })}
          error={errors.dosage}
        />
        <TextField
          label={t('plan.supplements.unit')}
          style={styles.flex1}
          value={form.unit}
          onChangeText={(v) => setForm({ ...form, unit: v })}
          error={errors.unit}
        />
      </View>
      <ChipSingleSelect
        label={t('plan.supplements.frequency')}
        options={frequencyOptions}
        value={form.frequency}
        onChange={(v) => setForm({ ...form, frequency: v })}
      />
      <ChipSingleSelect
        label={t('plan.supplements.timingOptional')}
        options={timingOptions}
        value={form.timing}
        onChange={(v) => setForm({ ...form, timing: v })}
      />
      <TextField
        label={t('plan.supplements.notesOptional')}
        value={form.notes}
        onChangeText={(v) => setForm({ ...form, notes: v })}
      />
      <ActiveToggle value={form.active} onChange={(v) => setForm({ ...form, active: v })} />
      <View style={styles.row}>
        <Button title={submitting ? t('common.saving') : t('common.save')} size="sm" onPress={submit} loading={submitting} style={styles.flex1} />
        {onCancel ? <Button title={t('common.cancel')} size="sm" variant="outline" onPress={onCancel} style={styles.flex1} /> : null}
      </View>
    </Card>
  );
}

function SupplementRow({
  supplement,
  onUpdated,
  onDeleted,
}: {
  supplement: Supplement;
  onUpdated: (s: Supplement) => void;
  onDeleted: () => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(data: CreateSupplementInput) {
    const updated = await updateSupplement(supplement.id, data);
    onUpdated(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!(await confirmDestructive(t('plan.deleteTitle', { name: supplement.name }), t('plan.supplements.deleteMessage')))) return;
    setDeleting(true);
    try {
      await deleteSupplement(supplement.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <SupplementForm
        initial={supplementToFormState(supplement)}
        onCancel={() => setEditing(false)}
        onSaved={handleSave}
      />
    );
  }

  return (
    <Card>
      <Text style={styles.rowTitle}>
        {supplement.active ? supplement.name : t('plan.supplements.inactive', { name: supplement.name })}
      </Text>
      <Text style={styles.rowSubtitle}>
        {describeSupplement(supplement) || t('plan.supplements.noDose')}
      </Text>
      <View style={styles.row}>
        <Button title={t('common.edit')} size="sm" variant="outline" onPress={() => setEditing(true)} style={styles.flex1} />
        <Button
          title={deleting ? t('plan.deleting') : t('common.delete')}
          size="sm"
          variant="destructive"
          onPress={handleDelete}
          loading={deleting}
          style={styles.flex1}
        />
      </View>
    </Card>
  );
}

export default function SupplementsScreen() {
  const { t } = useT();
  const [supplements, setSupplements] = useState<Supplement[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    listSupplements()
      .then(setSupplements)
      .catch(() => setLoadFailed(true));
  }, []);

  async function handleCreate(data: CreateSupplementInput) {
    const created = await createSupplement(data);
    setSupplements((prev) => [created, ...(prev ?? [])]);
    setAdding(false);
  }

  if (!supplements) {
    return (
      <View style={styles.centered}>
        {loadFailed ? <Alert variant="destructive">{t('plan.supplements.loadFailed')}</Alert> : <ActivityIndicator color={colors.primary.default} />}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {adding ? (
        <SupplementForm initial={EMPTY_FORM} onCancel={() => setAdding(false)} onSaved={handleCreate} />
      ) : (
        <Button title={t('plan.supplements.add')} size="sm" onPress={() => setAdding(true)} />
      )}

      {supplements.length === 0 && !adding ? <Text style={styles.empty}>{t('plan.supplements.empty')}</Text> : null}

      {supplements.map((supplement) => (
        <SupplementRow
          key={supplement.id}
          supplement={supplement}
          onUpdated={(updated) =>
            setSupplements((prev) => (prev ?? []).map((s) => (s.id === updated.id ? updated : s)))
          }
          onDeleted={() => setSupplements((prev) => (prev ?? []).filter((s) => s.id !== supplement.id))}
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
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeLabel: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 14,
    color: colors.foreground,
  },
  rowTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 15,
    color: colors.foreground,
  },
  rowSubtitle: {
    marginTop: 2,
    marginBottom: 10,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  empty: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
});

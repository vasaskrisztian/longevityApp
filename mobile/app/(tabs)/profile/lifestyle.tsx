import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { getProfileBundle, updateExerciseProfile } from '@/src/api/profile';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipMultiSelect, ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { colors } from '@/src/theme/tokens';
import {
  ActivityLevelEnum,
  ActivityTypeEnum,
  ExerciseProfileSchema,
  enumLabel,
  type ExerciseProfileInput,
} from '@/src/validation/schemas';
import { formatTagList, parseTagList } from '@/src/utils/tagList';

/** Single edit form mirroring the web app's profile/lifestyle/exercise-form.tsx
 * (phase 18) — same one-record-per-user pattern as nutrition.tsx. */

const ACTIVITY_LEVEL_OPTIONS: ChipOption[] = ActivityLevelEnum.options.map((v) => ({
  value: v,
  label: enumLabel(v),
}));
const ACTIVITY_TYPE_OPTIONS: ChipOption[] = ActivityTypeEnum.options.map((v) => ({
  value: v,
  label: enumLabel(v),
}));

interface LifestyleFormState {
  activityLevel: string;
  weeklyWorkoutCount: string;
  avgWorkoutDurationMin: string;
  activityTypes: string[];
  customActivities: string;
}

const DEFAULT_FORM: LifestyleFormState = {
  activityLevel: 'SEDENTARY',
  weeklyWorkoutCount: '',
  avgWorkoutDurationMin: '',
  activityTypes: [],
  customActivities: '',
};

export default function LifestyleScreen() {
  const [form, setForm] = useState<LifestyleFormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    getProfileBundle()
      .then((bundle) => {
        const e = bundle.exerciseProfile;
        setForm({
          activityLevel: e?.activityLevel ?? DEFAULT_FORM.activityLevel,
          weeklyWorkoutCount: e?.weeklyWorkoutCount != null ? String(e.weeklyWorkoutCount) : '',
          avgWorkoutDurationMin: e?.avgWorkoutDurationMin != null ? String(e.avgWorkoutDurationMin) : '',
          activityTypes: e?.activityTypes ?? [],
          customActivities: formatTagList(e?.customActivities),
        });
      })
      .catch(() => setServerError('Could not load your lifestyle profile.'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form) return;
    const parsed = ExerciseProfileSchema.safeParse({
      ...form,
      customActivities: parseTagList(form.customActivities),
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? '']),
      ));
      return;
    }
    setErrors({});
    setServerError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateExerciseProfile(parsed.data as ExerciseProfileInput);
      setSaved(true);
    } catch {
      setServerError('Could not save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        {serverError ? <Alert variant="destructive">{serverError}</Alert> : null}
        {saved ? <Alert variant="success">Saved.</Alert> : null}

        <ChipSingleSelect
          label="Activity level"
          options={ACTIVITY_LEVEL_OPTIONS}
          value={form.activityLevel}
          onChange={(v) => setForm({ ...form, activityLevel: v })}
        />
        <View style={styles.row}>
          <TextField
            label="Workouts / week (optional)"
            keyboardType="numeric"
            style={styles.flex1}
            value={form.weeklyWorkoutCount}
            onChangeText={(v) => setForm({ ...form, weeklyWorkoutCount: v })}
            error={errors.weeklyWorkoutCount}
          />
          <TextField
            label="Avg duration (min, optional)"
            keyboardType="numeric"
            style={styles.flex1}
            value={form.avgWorkoutDurationMin}
            onChangeText={(v) => setForm({ ...form, avgWorkoutDurationMin: v })}
            error={errors.avgWorkoutDurationMin}
          />
        </View>
        <ChipMultiSelect
          label="Activity types"
          options={ACTIVITY_TYPE_OPTIONS}
          values={form.activityTypes}
          onChange={(v) => setForm({ ...form, activityTypes: v })}
        />
        <TextField
          label="Custom activities (comma-separated, optional)"
          value={form.customActivities}
          onChangeText={(v) => setForm({ ...form, customActivities: v })}
        />
        <Button title={saving ? 'Saving…' : 'Save changes'} onPress={save} loading={saving} />
      </Card>
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
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
});

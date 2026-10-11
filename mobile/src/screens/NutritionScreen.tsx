import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { getProfileBundle, updateNutritionProfile } from '@/src/api/profile';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { colors } from '@/src/theme/tokens';
import { DietTypeEnum, NutritionProfileSchema, enumLabel, type NutritionProfileInput } from '@/src/validation/schemas';
import { formatTagList, parseTagList } from '@/src/utils/tagList';

/** Single edit form mirroring the web app's profile/nutrition/nutrition-form.tsx
 * (phase 18) — loads the bundle's nutritionProfile, saves the whole form on
 * submit (no per-field save like Goals/Supplements, since there's exactly
 * one record per user, same as the web version). */

const DIET_OPTIONS: ChipOption[] = DietTypeEnum.options.map((v) => ({ value: v, label: enumLabel(v) }));

interface NutritionFormState {
  dietType: string;
  dailyMealCount: string;
  dailyCaloriesKcal: string;
  dailyProteinGrams: string;
  allergies: string;
  intolerances: string;
  avoidedFoods: string;
  notes: string;
}

const DEFAULT_FORM: NutritionFormState = {
  dietType: 'OMNIVORE',
  dailyMealCount: '',
  dailyCaloriesKcal: '',
  dailyProteinGrams: '',
  allergies: '',
  intolerances: '',
  avoidedFoods: '',
  notes: '',
};

export default function NutritionScreen() {
  const [form, setForm] = useState<NutritionFormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    getProfileBundle()
      .then((bundle) => {
        const n = bundle.nutritionProfile;
        setForm({
          dietType: n?.dietType ?? DEFAULT_FORM.dietType,
          dailyMealCount: n?.dailyMealCount != null ? String(n.dailyMealCount) : '',
          dailyCaloriesKcal: n?.dailyCaloriesKcal != null ? String(n.dailyCaloriesKcal) : '',
          dailyProteinGrams: n?.dailyProteinGrams != null ? String(n.dailyProteinGrams) : '',
          allergies: formatTagList(n?.allergies),
          intolerances: formatTagList(n?.intolerances),
          avoidedFoods: formatTagList(n?.avoidedFoods),
          notes: n?.notes ?? '',
        });
      })
      .catch(() => setServerError('Could not load your nutrition profile.'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form) return;
    const parsed = NutritionProfileSchema.safeParse({
      ...form,
      allergies: parseTagList(form.allergies),
      intolerances: parseTagList(form.intolerances),
      avoidedFoods: parseTagList(form.avoidedFoods),
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
      await updateNutritionProfile(parsed.data as NutritionProfileInput);
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
          label="Diet type"
          options={DIET_OPTIONS}
          value={form.dietType}
          onChange={(v) => setForm({ ...form, dietType: v })}
        />
        <View style={styles.row}>
          <TextField
            label="Meals / day (optional)"
            keyboardType="numeric"
            style={styles.flex1}
            value={form.dailyMealCount}
            onChangeText={(v) => setForm({ ...form, dailyMealCount: v })}
            error={errors.dailyMealCount}
          />
          <TextField
            label="Calories / day (optional)"
            keyboardType="numeric"
            style={styles.flex1}
            value={form.dailyCaloriesKcal}
            onChangeText={(v) => setForm({ ...form, dailyCaloriesKcal: v })}
            error={errors.dailyCaloriesKcal}
          />
        </View>
        <TextField
          label="Protein (g/day, optional)"
          keyboardType="numeric"
          value={form.dailyProteinGrams}
          onChangeText={(v) => setForm({ ...form, dailyProteinGrams: v })}
          error={errors.dailyProteinGrams}
        />
        <TextField
          label="Allergies (comma-separated, optional)"
          value={form.allergies}
          onChangeText={(v) => setForm({ ...form, allergies: v })}
        />
        <TextField
          label="Intolerances (comma-separated, optional)"
          value={form.intolerances}
          onChangeText={(v) => setForm({ ...form, intolerances: v })}
        />
        <TextField
          label="Avoided foods (comma-separated, optional)"
          value={form.avoidedFoods}
          onChangeText={(v) => setForm({ ...form, avoidedFoods: v })}
        />
        <TextField
          label="Notes (optional)"
          value={form.notes}
          onChangeText={(v) => setForm({ ...form, notes: v })}
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

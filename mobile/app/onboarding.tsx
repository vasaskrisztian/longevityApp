import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { completeOnboarding } from '@/src/api/onboarding';
import { getProfileBundle } from '@/src/api/profile';
import { useSession } from '@/src/auth/useSession';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { ChipMultiSelect, ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { tDynamic, useT } from '@/src/i18n';
import { colors, fontFamily } from '@/src/theme/tokens';
import { parseTagList, formatTagList } from '@/src/utils/tagList';
import {
  ActivityLevelEnum,
  ActivityTypeEnum,
  DietTypeEnum,
  ExerciseProfileSchema,
  GenderEnum,
  NutritionProfileSchema,
  PersonalInfoSchema,
  enumLabel,
  type ExerciseProfileInput,
  type NutritionProfileInput,
  type PersonalInfoInput,
} from '@/src/validation/schemas';

/**
 * Mirrors the web app's onboarding-wizard.tsx — same three steps (Personal
 * → Exercise → Nutrition), same combined POST /api/onboarding at the end.
 * No react-hook-form here (not a mobile dependency yet, and login.tsx
 * already established the plain-useState + zod-safeParse pattern this
 * follows). Enum fields use ChipSelect instead of a native <select> (no
 * built-in RN equivalent); array-typed fields (customActivities/allergies/
 * intolerances/avoidedFoods) are edited as comma-separated text, same
 * convention as the web form.
 */

// The labels are translated, so the option lists are built at render time (never at module scope).
function enumOptions(values: readonly string[]): ChipOption[] {
  return values.map((v) => ({ value: v, label: enumLabel(v) }));
}

const STEP_KEYS = ['onboarding.step.personal', 'onboarding.step.exercise', 'onboarding.step.nutrition'] as const;

function StepProgress({ step }: { step: number }) {
  const { t } = useT();
  return (
    <View style={styles.progressRow}>
      {STEP_KEYS.map((key, index) => {
        const label = t(key);
        return (
          <View key={key} style={styles.progressStep}>
            <View style={[styles.progressDot, index <= step && styles.progressDotActive]}>
              <Text style={[styles.progressDotText, index <= step && styles.progressDotTextActive]}>{index + 1}</Text>
            </View>
            <Text style={[styles.progressLabel, index === step && styles.progressLabelActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

interface PersonalFormState {
  fullName: string;
  birthDate: string;
  gender: string | undefined;
  heightCm: string;
  weightKg: string;
  timezone: string;
}

function PersonalStep({ initial, onNext }: { initial: PersonalFormState; onNext: (data: PersonalInfoInput) => void }) {
  const { t } = useT();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const parsed = PersonalInfoSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ? tDynamic(v[0]) : '']),
        ),
      );
      return;
    }
    setErrors({});
    onNext(parsed.data);
  }

  return (
    <View style={styles.stepBody}>
      <TextField
        label={t('profile.field.fullName')}
        value={form.fullName}
        onChangeText={(v) => setForm({ ...form, fullName: v })}
        error={errors.fullName}
      />
      <TextField
        label={t('profile.field.birthDate')}
        placeholder={t('onboarding.birthDatePlaceholder')}
        value={form.birthDate}
        onChangeText={(v) => setForm({ ...form, birthDate: v })}
        error={errors.birthDate}
      />
      <ChipSingleSelect
        label={t('profile.field.genderOptional')}
        options={enumOptions(GenderEnum.options)}
        value={form.gender}
        onChange={(v) => setForm({ ...form, gender: v })}
      />
      <TextField
        label={t('profile.field.height')}
        keyboardType="numeric"
        value={form.heightCm}
        onChangeText={(v) => setForm({ ...form, heightCm: v })}
        error={errors.heightCm}
      />
      <TextField
        label={t('profile.field.weight')}
        keyboardType="numeric"
        value={form.weightKg}
        onChangeText={(v) => setForm({ ...form, weightKg: v })}
        error={errors.weightKg}
      />
      <TextField
        label={t('profile.field.timezone')}
        value={form.timezone}
        onChangeText={(v) => setForm({ ...form, timezone: v })}
        error={errors.timezone}
      />
      <Button title={t('onboarding.continue')} onPress={submit} />
    </View>
  );
}

interface ExerciseFormState {
  activityLevel: string;
  weeklyWorkoutCount: string;
  avgWorkoutDurationMin: string;
  activityTypes: string[];
  customActivities: string;
}

function ExerciseStep({
  initial,
  onBack,
  onNext,
}: {
  initial: ExerciseFormState;
  onBack: () => void;
  onNext: (data: ExerciseProfileInput) => void;
}) {
  const { t } = useT();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const parsed = ExerciseProfileSchema.safeParse({
      ...form,
      customActivities: parseTagList(form.customActivities),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ? tDynamic(v[0]) : '']),
        ),
      );
      return;
    }
    setErrors({});
    onNext(parsed.data);
  }

  return (
    <View style={styles.stepBody}>
      <ChipSingleSelect
        label={t('profile.field.activityLevel')}
        options={enumOptions(ActivityLevelEnum.options)}
        value={form.activityLevel}
        onChange={(v) => setForm({ ...form, activityLevel: v })}
      />
      {errors.activityLevel ? <Text style={styles.fieldError}>{errors.activityLevel}</Text> : null}
      <TextField
        label={t('profile.field.workoutsPerWeek')}
        keyboardType="numeric"
        value={form.weeklyWorkoutCount}
        onChangeText={(v) => setForm({ ...form, weeklyWorkoutCount: v })}
      />
      <TextField
        label={t('profile.field.avgDurationOnboarding')}
        keyboardType="numeric"
        value={form.avgWorkoutDurationMin}
        onChangeText={(v) => setForm({ ...form, avgWorkoutDurationMin: v })}
      />
      <ChipMultiSelect
        label={t('profile.field.activityTypes')}
        options={enumOptions(ActivityTypeEnum.options)}
        values={form.activityTypes}
        onChange={(v) => setForm({ ...form, activityTypes: v })}
      />
      <TextField
        label={t('profile.field.otherActivities')}
        placeholder={t('onboarding.otherActivitiesPlaceholder')}
        value={form.customActivities}
        onChangeText={(v) => setForm({ ...form, customActivities: v })}
      />
      <View style={styles.buttonRow}>
        <Button title={t('common.back')} variant="outline" onPress={onBack} style={styles.flexButton} />
        <Button title={t('onboarding.continue')} onPress={submit} style={styles.flexButton} />
      </View>
    </View>
  );
}

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

function NutritionStep({
  initial,
  onBack,
  onSubmitFinal,
  submitting,
  serverError,
}: {
  initial: NutritionFormState;
  onBack: () => void;
  onSubmitFinal: (data: NutritionProfileInput) => void;
  submitting: boolean;
  serverError: boolean;
}) {
  const { t } = useT();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const parsed = NutritionProfileSchema.safeParse({
      ...form,
      allergies: parseTagList(form.allergies),
      intolerances: parseTagList(form.intolerances),
      avoidedFoods: parseTagList(form.avoidedFoods),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ? tDynamic(v[0]) : '']),
        ),
      );
      return;
    }
    setErrors({});
    onSubmitFinal(parsed.data);
  }

  return (
    <View style={styles.stepBody}>
      {serverError ? <Alert variant="destructive">{t('onboarding.saveFailed')}</Alert> : null}
      <ChipSingleSelect
        label={t('profile.field.dietType')}
        options={enumOptions(DietTypeEnum.options)}
        value={form.dietType}
        onChange={(v) => setForm({ ...form, dietType: v })}
      />
      {errors.dietType ? <Text style={styles.fieldError}>{errors.dietType}</Text> : null}
      <TextField
        label={t('profile.field.mealsPerDay')}
        keyboardType="numeric"
        value={form.dailyMealCount}
        onChangeText={(v) => setForm({ ...form, dailyMealCount: v })}
      />
      <TextField
        label={t('profile.field.caloriesPerDay')}
        keyboardType="numeric"
        value={form.dailyCaloriesKcal}
        onChangeText={(v) => setForm({ ...form, dailyCaloriesKcal: v })}
      />
      <TextField
        label={t('profile.field.proteinOnboarding')}
        keyboardType="numeric"
        value={form.dailyProteinGrams}
        onChangeText={(v) => setForm({ ...form, dailyProteinGrams: v })}
      />
      <TextField
        label={t('profile.field.allergiesOnboarding')}
        placeholder={t('onboarding.allergiesPlaceholder')}
        value={form.allergies}
        onChangeText={(v) => setForm({ ...form, allergies: v })}
      />
      <TextField
        label={t('profile.field.intolerancesOnboarding')}
        placeholder={t('onboarding.intolerancesPlaceholder')}
        value={form.intolerances}
        onChangeText={(v) => setForm({ ...form, intolerances: v })}
      />
      <TextField
        label={t('profile.field.avoidedFoodsOnboarding')}
        placeholder={t('onboarding.avoidedFoodsPlaceholder')}
        value={form.avoidedFoods}
        onChangeText={(v) => setForm({ ...form, avoidedFoods: v })}
      />
      <TextField
        label={t('profile.field.notes')}
        multiline
        value={form.notes}
        onChangeText={(v) => setForm({ ...form, notes: v })}
      />
      <View style={styles.buttonRow}>
        <Button
          title={t('common.back')}
          variant="outline"
          onPress={onBack}
          disabled={submitting}
          style={styles.flexButton}
        />
        <Button title={t('onboarding.finish')} onPress={submit} loading={submitting} style={styles.flexButton} />
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { t } = useT();
  const { status, user } = useSession();
  const [step, setStep] = useState(0);
  const [initialFullName, setInitialFullName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [personal, setPersonal] = useState<PersonalInfoInput | null>(null);
  const [exercise, setExercise] = useState<ExerciseProfileInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(false);

  useEffect(() => {
    if (status !== 'signedIn') return;
    getProfileBundle()
      .then((bundle) => setInitialFullName(bundle.profile?.fullName ?? ''))
      .catch(() => undefined)
      .finally(() => setLoadingProfile(false));
  }, [status]);

  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }
  if (status === 'loading' || loadingProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  async function finish(nutrition: NutritionProfileInput) {
    if (!personal || !exercise) return; // unreachable — earlier steps always run first
    setServerError(false);
    setSubmitting(true);
    try {
      await completeOnboarding({ personal, exercise, nutrition });
      router.replace('/');
    } catch {
      setServerError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('onboarding.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
      <StepProgress step={step} />

      {step === 0 && (
        <PersonalStep
          initial={
            personal
              ? {
                  ...personal,
                  gender: personal.gender,
                  heightCm: String(personal.heightCm),
                  weightKg: String(personal.weightKg),
                }
              : {
                  fullName: initialFullName,
                  birthDate: '',
                  gender: undefined,
                  heightCm: '',
                  weightKg: '',
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
                }
          }
          onNext={(data) => {
            setPersonal(data);
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <ExerciseStep
          initial={
            exercise
              ? {
                  ...exercise,
                  weeklyWorkoutCount: String(exercise.weeklyWorkoutCount ?? ''),
                  avgWorkoutDurationMin: String(exercise.avgWorkoutDurationMin ?? ''),
                  customActivities: formatTagList(exercise.customActivities),
                }
              : {
                  activityLevel: 'MODERATELY_ACTIVE',
                  weeklyWorkoutCount: '',
                  avgWorkoutDurationMin: '',
                  activityTypes: [],
                  customActivities: '',
                }
          }
          onBack={() => setStep(0)}
          onNext={(data) => {
            setExercise(data);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <NutritionStep
          initial={{
            dietType: 'OMNIVORE',
            dailyMealCount: '',
            dailyCaloriesKcal: '',
            dailyProteinGrams: '',
            allergies: '',
            intolerances: '',
            avoidedFoods: '',
            notes: '',
          }}
          onBack={() => setStep(1)}
          onSubmitFinal={finish}
          submitting={submitting}
          serverError={serverError}
        />
      )}
      <Text style={styles.emailHint}>{user?.email}</Text>
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
    paddingBottom: 60,
    // Readable column on a wide desktop window (no-op on a phone).
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    color: colors.foreground,
  },
  subtitle: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted.default,
  },
  progressDotActive: {
    backgroundColor: colors.primary.default,
  },
  progressDotText: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  progressDotTextActive: {
    color: colors.primary.foreground,
  },
  progressLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
  progressLabelActive: {
    fontFamily: fontFamily.sansMedium,
    color: colors.foreground,
  },
  stepBody: {
    gap: 14,
  },
  fieldError: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.danger,
    marginTop: -8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  emailHint: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
    textAlign: 'center',
  },
});

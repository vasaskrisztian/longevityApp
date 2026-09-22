'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  PersonalInfoSchema,
  ExerciseProfileSchema,
  NutritionProfileSchema,
  GenderEnum,
  ActivityLevelEnum,
  ActivityTypeEnum,
  DietTypeEnum,
  type PersonalInfoInput,
  type ExerciseProfileInput,
  type NutritionProfileInput,
} from '@/lib/validation/onboarding.schemas';
import { parseTagList, formatTagList } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const STEPS = ['Personal', 'Exercise', 'Nutrition'] as const;

function StepProgress({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {STEPS.map((label, index) => (
        <div key={label} className="flex flex-1 items-center gap-2">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              index <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {index + 1}
          </div>
          <span
            className={`hidden text-sm sm:inline ${index === step ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
          >
            {label}
          </span>
          {index < STEPS.length - 1 && <div className="h-px flex-1 bg-card-border" />}
        </div>
      ))}
    </div>
  );
}

// The array-typed fields below (customActivities/allergies/intolerances/
// avoidedFoods) are edited as a single comma-separated text field in the UI
// for simplicity, then split into arrays on submit — see parseTagList in
// lib/utils.ts. The real, authoritative array schemas live in
// onboarding.schemas.ts and are what the API route validates against.
const ExerciseFormSchema = ExerciseProfileSchema.extend({
  customActivities: z.string().optional(),
});
type ExerciseFormInput = Omit<z.infer<typeof ExerciseFormSchema>, 'activityTypes'> & {
  activityTypes: ExerciseProfileInput['activityTypes'];
};

const NutritionFormSchema = NutritionProfileSchema.extend({
  allergies: z.string().optional(),
  intolerances: z.string().optional(),
  avoidedFoods: z.string().optional(),
});
type NutritionFormInput = z.infer<typeof NutritionFormSchema>;

function PersonalStep({
  defaultValues,
  onNext,
}: {
  defaultValues: Partial<PersonalInfoInput>;
  onNext: (data: PersonalInfoInput) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalInfoInput>({
    resolver: zodResolver(PersonalInfoSchema),
    defaultValues: {
      timezone:
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" {...register('fullName')} />
        {errors.fullName && <p className="text-sm text-danger">{errors.fullName.message}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="birthDate">Birth date</Label>
          <Input id="birthDate" type="date" {...register('birthDate')} />
          {errors.birthDate && <p className="text-sm text-danger">{errors.birthDate.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender (optional)</Label>
          <Select id="gender" defaultValue="" {...register('gender')}>
            <option value="">Prefer not to say</option>
            {GenderEnum.options.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="heightCm">Height (cm)</Label>
          <Input id="heightCm" type="number" step="0.1" {...register('heightCm')} />
          {errors.heightCm && <p className="text-sm text-danger">{errors.heightCm.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="weightKg">Weight (kg)</Label>
          <Input id="weightKg" type="number" step="0.1" {...register('weightKg')} />
          {errors.weightKg && <p className="text-sm text-danger">{errors.weightKg.message}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" {...register('timezone')} />
        {errors.timezone && <p className="text-sm text-danger">{errors.timezone.message}</p>}
      </div>
      <Button type="submit" className="w-full">
        Continue
      </Button>
    </form>
  );
}

function ExerciseStep({
  defaultValues,
  onBack,
  onNext,
}: {
  defaultValues: Partial<ExerciseFormInput>;
  onBack: () => void;
  onNext: (data: ExerciseProfileInput) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof ExerciseFormSchema>>({
    resolver: zodResolver(ExerciseFormSchema),
    defaultValues: { activityTypes: [], ...defaultValues },
  });

  function submit(data: z.infer<typeof ExerciseFormSchema>) {
    onNext({
      ...data,
      customActivities: parseTagList(data.customActivities ?? ''),
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="activityLevel">Activity level</Label>
        <Select id="activityLevel" {...register('activityLevel')}>
          {ActivityLevelEnum.options.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </option>
          ))}
        </Select>
        {errors.activityLevel && (
          <p className="text-sm text-danger">{errors.activityLevel.message}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="weeklyWorkoutCount">Workouts / week (optional)</Label>
          <Input id="weeklyWorkoutCount" type="number" {...register('weeklyWorkoutCount')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="avgWorkoutDurationMin">Avg. duration, min (optional)</Label>
          <Input
            id="avgWorkoutDurationMin"
            type="number"
            {...register('avgWorkoutDurationMin')}
          />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Activity types</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ActivityTypeEnum.options.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={value} {...register('activityTypes')} />
              {value.replaceAll('_', ' ')}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="customActivities">Other activities (optional, comma-separated)</Label>
        <Input id="customActivities" placeholder="e.g. rock climbing, tennis" {...register('customActivities')} />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" className="flex-1">
          Continue
        </Button>
      </div>
    </form>
  );
}

function NutritionStep({
  defaultValues,
  onBack,
  onSubmitFinal,
  submitting,
  serverError,
}: {
  defaultValues: Partial<NutritionFormInput>;
  onBack: () => void;
  onSubmitFinal: (data: NutritionProfileInput) => void;
  submitting: boolean;
  serverError: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NutritionFormInput>({
    resolver: zodResolver(NutritionFormSchema),
    defaultValues,
  });

  function submit(data: NutritionFormInput) {
    onSubmitFinal({
      ...data,
      allergies: parseTagList(data.allergies ?? ''),
      intolerances: parseTagList(data.intolerances ?? ''),
      avoidedFoods: parseTagList(data.avoidedFoods ?? ''),
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {serverError && <Alert variant="destructive">{serverError}</Alert>}
      <div className="space-y-2">
        <Label htmlFor="dietType">Diet type</Label>
        <Select id="dietType" {...register('dietType')}>
          {DietTypeEnum.options.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </option>
          ))}
        </Select>
        {errors.dietType && <p className="text-sm text-danger">{errors.dietType.message}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="dailyMealCount">Meals / day (optional)</Label>
          <Input id="dailyMealCount" type="number" {...register('dailyMealCount')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dailyCaloriesKcal">Calories / day (optional)</Label>
          <Input id="dailyCaloriesKcal" type="number" {...register('dailyCaloriesKcal')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dailyProteinGrams">Protein, g / day (optional)</Label>
          <Input id="dailyProteinGrams" type="number" {...register('dailyProteinGrams')} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies (optional, comma-separated)</Label>
        <Input id="allergies" placeholder="e.g. peanuts, shellfish" {...register('allergies')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="intolerances">Intolerances (optional, comma-separated)</Label>
        <Input id="intolerances" placeholder="e.g. lactose" {...register('intolerances')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="avoidedFoods">Avoided foods (optional, comma-separated)</Label>
        <Input id="avoidedFoods" placeholder="e.g. red meat" {...register('avoidedFoods')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" {...register('notes')} />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? 'Saving…' : 'Finish'}
        </Button>
      </div>
    </form>
  );
}

export function OnboardingWizard({ initialFullName }: { initialFullName?: string }) {
  const [step, setStep] = useState(0);
  const [personal, setPersonal] = useState<PersonalInfoInput | null>(null);
  const [exercise, setExercise] = useState<ExerciseProfileInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function finish(nutrition: NutritionProfileInput) {
    if (!personal || !exercise) return; // unreachable — earlier steps always run first
    setServerError(null);
    setSubmitting(true);
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personal, exercise, nutrition }),
    });
    setSubmitting(false);

    if (!response.ok) {
      setServerError('Something went wrong saving your profile. Please try again.');
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Let&rsquo;s set up your profile</CardTitle>
        <CardDescription>
          Three quick steps — personal info, exercise habits, and nutrition — so your
          dashboard and insights make sense from day one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StepProgress step={step} />
        {step === 0 && (
          <PersonalStep
            defaultValues={personal ?? { fullName: initialFullName }}
            onNext={(data) => {
              setPersonal(data);
              setStep(1);
            }}
          />
        )}
        {step === 1 && (
          <ExerciseStep
            defaultValues={
              exercise
                ? { ...exercise, customActivities: formatTagList(exercise.customActivities) }
                : {}
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
            defaultValues={{}}
            onBack={() => setStep(1)}
            onSubmitFinal={finish}
            submitting={submitting}
            serverError={serverError}
          />
        )}
      </CardContent>
    </Card>
  );
}

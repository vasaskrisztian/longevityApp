'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExerciseProfileSchema, ActivityLevelEnum, ActivityTypeEnum } from '@/lib/validation/onboarding.schemas';
import { parseTagList, formatTagList } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';

// See onboarding-wizard.tsx for why customActivities is a comma-separated
// text field on the client but a string[] in the real schema/API contract.
const ExerciseFormSchema = ExerciseProfileSchema.extend({
  customActivities: z.string().optional(),
});
type ExerciseFormValues = z.infer<typeof ExerciseFormSchema>;

export interface ExerciseFormDefaults {
  activityLevel: z.infer<typeof ActivityLevelEnum>;
  weeklyWorkoutCount?: number;
  avgWorkoutDurationMin?: number;
  activityTypes: z.infer<typeof ActivityTypeEnum>[];
  customActivities: string[];
}

export function ExerciseProfileForm({ defaultValues }: { defaultValues: ExerciseFormDefaults }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExerciseFormValues>({
    resolver: zodResolver(ExerciseFormSchema),
    defaultValues: {
      ...defaultValues,
      customActivities: formatTagList(defaultValues.customActivities),
    },
  });

  async function onSubmit(data: ExerciseFormValues) {
    setServerError(null);
    setSaved(false);
    setSubmitting(true);
    const response = await fetch('/api/profile/exercise', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        customActivities: parseTagList(data.customActivities ?? ''),
      }),
    });
    setSubmitting(false);
    if (!response.ok) {
      setServerError('Could not save your changes. Please try again.');
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && <Alert variant="destructive">{serverError}</Alert>}
      {saved && <Alert variant="success">Saved.</Alert>}
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
          <Label htmlFor="weeklyWorkoutCount">Workouts / week</Label>
          <Input id="weeklyWorkoutCount" type="number" {...register('weeklyWorkoutCount')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="avgWorkoutDurationMin">Avg. duration, min</Label>
          <Input id="avgWorkoutDurationMin" type="number" {...register('avgWorkoutDurationMin')} />
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
        <Label htmlFor="customActivities">Other activities (comma-separated)</Label>
        <Input id="customActivities" {...register('customActivities')} />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

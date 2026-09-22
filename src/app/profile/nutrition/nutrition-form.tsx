'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NutritionProfileSchema, DietTypeEnum } from '@/lib/validation/onboarding.schemas';
import { parseTagList, formatTagList } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';

// See onboarding-wizard.tsx for why allergies/intolerances/avoidedFoods are
// comma-separated text fields on the client but string[] in the real
// schema/API contract.
const NutritionFormSchema = NutritionProfileSchema.extend({
  allergies: z.string().optional(),
  intolerances: z.string().optional(),
  avoidedFoods: z.string().optional(),
});
type NutritionFormValues = z.infer<typeof NutritionFormSchema>;

export interface NutritionFormDefaults {
  dietType: z.infer<typeof DietTypeEnum>;
  dailyMealCount?: number;
  dailyCaloriesKcal?: number;
  dailyProteinGrams?: number;
  allergies: string[];
  intolerances: string[];
  avoidedFoods: string[];
  notes?: string;
}

export function NutritionProfileForm({ defaultValues }: { defaultValues: NutritionFormDefaults }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NutritionFormValues>({
    resolver: zodResolver(NutritionFormSchema),
    defaultValues: {
      ...defaultValues,
      allergies: formatTagList(defaultValues.allergies),
      intolerances: formatTagList(defaultValues.intolerances),
      avoidedFoods: formatTagList(defaultValues.avoidedFoods),
    },
  });

  async function onSubmit(data: NutritionFormValues) {
    setServerError(null);
    setSaved(false);
    setSubmitting(true);
    const response = await fetch('/api/profile/nutrition', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        allergies: parseTagList(data.allergies ?? ''),
        intolerances: parseTagList(data.intolerances ?? ''),
        avoidedFoods: parseTagList(data.avoidedFoods ?? ''),
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
          <Label htmlFor="dailyMealCount">Meals / day</Label>
          <Input id="dailyMealCount" type="number" {...register('dailyMealCount')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dailyCaloriesKcal">Calories / day</Label>
          <Input id="dailyCaloriesKcal" type="number" {...register('dailyCaloriesKcal')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dailyProteinGrams">Protein, g / day</Label>
          <Input id="dailyProteinGrams" type="number" {...register('dailyProteinGrams')} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies (comma-separated)</Label>
        <Input id="allergies" {...register('allergies')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="intolerances">Intolerances (comma-separated)</Label>
        <Input id="intolerances" {...register('intolerances')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="avoidedFoods">Avoided foods (comma-separated)</Label>
        <Input id="avoidedFoods" {...register('avoidedFoods')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...register('notes')} />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PersonalInfoSchema, GenderEnum, type PersonalInfoInput } from '@/lib/validation/onboarding.schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';

// The form works with birthDate as the plain "yyyy-mm-dd" string a native
// <input type="date"> produces/accepts; PersonalInfoSchema's z.coerce.date()
// turns that string into a real Date server-side (and in onboarding-wizard's
// PersonalStep) — this component never needs a Date instance itself.
export type PersonalInfoFormValues = Omit<PersonalInfoInput, 'birthDate'> & { birthDate: string };

export function PersonalInfoForm({ defaultValues }: { defaultValues: PersonalInfoFormValues }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalInfoFormValues>({
    // PersonalInfoSchema's coerced birthDate/heightCm/weightKg fields don't
    // line up 1:1 with the pre-coercion string form values react-hook-form
    // works with here, hence the cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(PersonalInfoSchema) as any,
    defaultValues,
  });

  async function onSubmit(data: PersonalInfoFormValues) {
    setServerError(null);
    setSaved(false);
    setSubmitting(true);
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
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
          <Label htmlFor="gender">Gender</Label>
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
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

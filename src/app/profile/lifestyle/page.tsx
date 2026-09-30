import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExerciseProfileForm, type ExerciseFormDefaults } from './exercise-form';

export default async function LifestylePage() {
  const user = await requireAuthenticatedUserForPage();
  const exerciseProfile = await prisma.exerciseProfile.findUnique({ where: { userId: user.id } });

  const defaultValues: ExerciseFormDefaults = {
    activityLevel: exerciseProfile?.activityLevel ?? 'MODERATELY_ACTIVE',
    weeklyWorkoutCount: exerciseProfile?.weeklyWorkoutCount ?? undefined,
    avgWorkoutDurationMin: exerciseProfile?.avgWorkoutDurationMin ?? undefined,
    activityTypes: exerciseProfile?.activityTypes ?? [],
    customActivities: exerciseProfile?.customActivities ?? [],
  };

  return (
    <div className="space-y-6">
      <h1 className="relative inline-block font-display text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-2/3 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent">Lifestyle</h1>
      <Card>
        <CardHeader>
          <CardTitle>Exercise profile</CardTitle>
          <CardDescription>
            Activity level, weekly workouts, and activity types.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExerciseProfileForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </div>
  );
}

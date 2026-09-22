import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { NutritionProfileForm, type NutritionFormDefaults } from './nutrition-form';

export default async function NutritionPage() {
  const user = await requireAuthenticatedUserForPage();
  const nutritionProfile = await prisma.nutritionProfile.findUnique({ where: { userId: user.id } });

  const defaultValues: NutritionFormDefaults = {
    dietType: nutritionProfile?.dietType ?? 'OMNIVORE',
    dailyMealCount: nutritionProfile?.dailyMealCount ?? undefined,
    dailyCaloriesKcal: nutritionProfile?.dailyCaloriesKcal ?? undefined,
    dailyProteinGrams: nutritionProfile?.dailyProteinGrams ?? undefined,
    allergies: nutritionProfile?.allergies ?? [],
    intolerances: nutritionProfile?.intolerances ?? [],
    avoidedFoods: nutritionProfile?.avoidedFoods ?? [],
    notes: nutritionProfile?.notes ?? undefined,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nutrition</h1>
      <Card>
        <CardHeader>
          <CardTitle>Nutrition profile</CardTitle>
          <CardDescription>
            Diet type, meal count, allergies and intolerances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NutritionProfileForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </div>
  );
}

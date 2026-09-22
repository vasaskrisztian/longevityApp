import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PersonalInfoForm, type PersonalInfoFormValues } from './personal-info-form';

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 10);
}

export default async function ProfilePage() {
  const user = await requireAuthenticatedUserForPage();
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  const defaultValues: PersonalInfoFormValues = {
    fullName: profile?.fullName ?? '',
    birthDate: toDateInputValue(profile?.birthDate),
    gender: profile?.gender ?? undefined,
    heightCm: profile ? Number(profile.heightCm) : 0,
    weightKg: profile ? Number(profile.weightKg) : 0,
    timezone: profile?.timezone ?? 'UTC',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Used for your dashboard and to personalize insights.</CardDescription>
        </CardHeader>
        <CardContent>
          <PersonalInfoForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </div>
  );
}

import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PersonalInfoForm, type PersonalInfoFormValues } from './personal-info-form';
import { CreatorConsentToggle } from './creator-consent-toggle';

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 10);
}

export default async function ProfilePage() {
  const user = await requireAuthenticatedUserForPage();
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  // Phase 13: only CREATOR accounts can ever have a public profile — see
  // creators.service.ts's doc comment. accountType is granted by an admin
  // only (admin.service.ts's setUserAccountType), never self-serve.
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { accountType: true, publicProfileConsentAt: true },
  });

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
      <h1 className="relative inline-block font-display text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-2/3 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Used for your dashboard and to personalize insights.</CardDescription>
        </CardHeader>
        <CardContent>
          <PersonalInfoForm defaultValues={defaultValues} />
        </CardContent>
      </Card>

      {account?.accountType === 'CREATOR' && (
        <Card>
          <CardHeader>
            <CardTitle>Creator public profile</CardTitle>
            <CardDescription>
              An admin has granted this account creator status. Enabling a public profile lets anyone —
              including people without an account — see protocols and challenges you mark Public, plus your
              recent health data. Nothing is shown unless you enable this AND mark individual items Public.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreatorConsentToggle initialConsent={Boolean(account.publicProfileConsentAt)} userId={user.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

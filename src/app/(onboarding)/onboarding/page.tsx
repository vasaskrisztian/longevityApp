import { redirect } from 'next/navigation';
import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { isOnboardingComplete, getProfileBundle } from '@/modules/profile/profile.service';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUserForPage();

  if (await isOnboardingComplete(user.id)) {
    redirect('/dashboard');
  }

  // registerUser() (auth.service.ts) already created a Profile row with the
  // real fullName the person typed at sign-up, alongside placeholder
  // birthDate/height/weight that onboarding is what actually collects. Only
  // fullName is genuine data at this point, so it's the only field worth
  // pre-filling — asking someone to retype the name they just gave two
  // screens ago is exactly the friction this wizard shouldn't add.
  const { profile } = await getProfileBundle(user.id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <OnboardingWizard initialFullName={profile?.fullName ?? ''} />
      </div>
    </div>
  );
}

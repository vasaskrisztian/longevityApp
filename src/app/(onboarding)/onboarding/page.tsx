import { redirect } from 'next/navigation';
import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { isOnboardingComplete } from '@/modules/profile/profile.service';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUserForPage();

  if (await isOnboardingComplete(user.id)) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <OnboardingWizard />
      </div>
    </div>
  );
}

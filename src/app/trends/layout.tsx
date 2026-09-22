import { requireOnboardedUserForPage } from '@/lib/auth/page-guards';
import { AppShell } from '@/components/app-shell/app-shell';

export default async function TrendsLayout({ children }: { children: React.ReactNode }) {
  await requireOnboardedUserForPage();
  return <AppShell>{children}</AppShell>;
}

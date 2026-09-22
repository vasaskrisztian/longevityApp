import { requireAdminForPage } from '@/lib/auth/page-guards';
import { AppShell } from '@/components/app-shell/app-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminForPage();
  return <AppShell>{children}</AppShell>;
}

import { Sidebar } from './sidebar';
import { DeviceAutoSync } from './device-auto-sync';
import { NotificationPoller } from './notification-poller';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <DeviceAutoSync />
      <NotificationPoller />
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { getConnectionForUserAndProvider } from '@/modules/wearable/services/wearable.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Not connected',
  AUTH_REQUIRED: 'Reconnect required',
  ERROR: 'Connection error',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  CONNECTED: 'bg-emerald-100 text-emerald-800',
  DISCONNECTED: 'bg-muted text-muted-foreground',
  AUTH_REQUIRED: 'bg-amber-100 text-amber-800',
  ERROR: 'bg-red-100 text-red-800',
};

const OURA_ERROR_MESSAGE: Record<string, string> = {
  denied: 'You declined the Oura authorization request, so nothing was connected.',
  exchange_failed: "Oura's servers rejected the connection attempt. Please try again.",
};

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: { oura_error?: string };
}) {
  const user = await requireAuthenticatedUserForPage();
  // Domain service, not a direct Prisma call — see modules/wearable/services
  // (ARCHITECTURE.md §2: business logic, including "what does this status
  // mean", belongs in modules/**, not in app/**). Returns a synthesized
  // DISCONNECTED summary if the user has never attempted to connect Oura.
  const connection = await getConnectionForUserAndProvider(user.id, 'OURA');

  const isConnected = connection.status === 'CONNECTED';
  const canReconnect = connection.status === 'AUTH_REQUIRED' || connection.status === 'ERROR';
  const errorMessage = OURA_ERROR_MESSAGE[searchParams.oura_error ?? ''];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
      {errorMessage && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Oura Ring</CardTitle>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[connection.status]}`}
            >
              {STATUS_LABEL[connection.status]}
            </span>
          </div>
          <CardDescription>
            {isConnected
              ? 'Your Oura account is connected.'
              : canReconnect
                ? 'Your Oura connection needs attention — reconnect to resume syncing.'
                : 'Connect your Oura account to automatically synchronize sleep, recovery and activity data.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connection.lastSyncAt && (
            <p className="text-sm text-muted-foreground">
              Last sync attempt: {connection.lastSyncAt.toLocaleString()}
              {connection.lastSyncStatus ? ` (${connection.lastSyncStatus})` : ''}
            </p>
          )}
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Button variant="outline" disabled title="Wired up in Phase 5/7">
                  Sync now
                </Button>
                <form action="/api/integrations/oura/disconnect" method="POST">
                  <button type="submit" className={cn(buttonVariants({ variant: 'destructive' }))}>
                    Disconnect
                  </button>
                </form>
              </>
            ) : (
              <a href="/api/integrations/oura/connect" className={cn(buttonVariants({ variant: 'primary' }))}>
                {canReconnect ? 'Reconnect Oura' : 'Connect Oura'}
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Historical import and daily sync (ARCHITECTURE.md §7) ship in
            Phase 5/7 — connecting today records the connection and queues
            the initial sync, but nothing processes that queue yet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

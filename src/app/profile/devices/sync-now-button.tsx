'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

type Status = 'idle' | 'submitting' | 'success' | 'rate_limited' | 'not_connected' | 'error';

const MESSAGE: Record<Exclude<Status, 'idle' | 'submitting'>, string> = {
  success: 'Sync queued — your latest Oura data will appear here in a few minutes.',
  rate_limited: 'You already triggered a sync in the last 5 minutes. Please wait before retrying.',
  not_connected: 'Your Oura account is not connected, so there is nothing to sync.',
  error: 'Could not trigger a sync. Please try again.',
};

/**
 * POSTs to the same manual-sync endpoint the admin "trigger sync" action
 * uses (see app/admin/users/[id]/trigger-sync-button.tsx), just scoped to
 * the signed-in user's own connection instead of an admin-picked target —
 * the route itself (ARCHITECTURE.md §7.5) always resolves the connection
 * from the authenticated caller, never a request body, so there's no id to
 * pass here. Rate limit is per-user (5 minutes), enforced server-side.
 */
export function SyncNowButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');

  async function handleClick() {
    setStatus('submitting');
    try {
      const response = await fetch('/api/integrations/oura/sync', { method: 'POST' });
      if (response.status === 202) {
        setStatus('success');
        // The job is queued, not finished — this just refreshes the
        // server-rendered "Last sync attempt" line a little later so it
        // reflects the manual sync once the worker has picked it up,
        // without making the user manually reload the page.
        setTimeout(() => router.refresh(), 5000);
      } else if (response.status === 429) {
        setStatus('rate_limited');
      } else if (response.status === 409) {
        setStatus('not_connected');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? 'Syncing…' : 'Sync now'}
      </Button>
      {status !== 'idle' && status !== 'submitting' && (
        <Alert variant={status === 'success' ? 'success' : 'destructive'}>
          {MESSAGE[status]}
        </Alert>
      )}
    </div>
  );
}

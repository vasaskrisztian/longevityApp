'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

type Status = 'idle' | 'submitting' | 'success' | 'rate_limited' | 'not_connected' | 'error';

const MESSAGE: Record<Exclude<Status, 'idle' | 'submitting'>, string> = {
  success: 'Sync queued. It will run in the background shortly.',
  rate_limited: 'A sync was already triggered for this user in the last 5 minutes. Please wait before retrying.',
  not_connected: 'This user has no connected Oura account to sync.',
  error: 'Could not trigger a sync. Please try again.',
};

/**
 * POSTs to the exact same endpoint an admin's "manual sync" action hits
 * (ARCHITECTURE.md §8.2) — the rate limit is keyed by the target user, so a
 * second click within 5 minutes surfaces the 429 as a normal, expected state
 * rather than a bug.
 */
export function TriggerSyncButton({ userId }: { userId: string }) {
  const [status, setStatus] = useState<Status>('idle');

  async function handleClick() {
    setStatus('submitting');
    try {
      const response = await fetch(`/api/admin/users/${userId}/sync`, { method: 'POST' });
      if (response.status === 202) {
        setStatus('success');
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
        size="sm"
        onClick={handleClick}
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? 'Triggering sync…' : 'Trigger sync now'}
      </Button>
      {status !== 'idle' && status !== 'submitting' && (
        <Alert variant={status === 'success' ? 'success' : 'destructive'}>
          {MESSAGE[status]}
        </Alert>
      )}
    </div>
  );
}

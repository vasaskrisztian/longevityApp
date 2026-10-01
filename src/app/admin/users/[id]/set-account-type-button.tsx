'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

/** PATCHes the same endpoint an admin's "grant/revoke creator" action hits
 * (ARCHITECTURE.md §8's admin-action pattern, matching TriggerSyncButton). */
export function SetAccountTypeButton({
  userId,
  currentAccountType,
}: {
  userId: string;
  currentAccountType: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextType = currentAccountType === 'CREATOR' ? 'MEMBER' : 'CREATOR';

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/account-type`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: nextType }),
      });
      if (!response.ok) {
        setError('Could not update this account type. Please try again.');
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleClick}>
        {nextType === 'CREATOR' ? 'Grant creator status' : 'Revoke creator status'}
      </Button>
      {nextType === 'MEMBER' && (
        <p className="text-xs text-muted-foreground">
          Revoking also disables their public profile and sets all their protocols/challenges back to
          Private immediately.
        </p>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}

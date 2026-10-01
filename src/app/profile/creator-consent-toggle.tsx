'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

/**
 * Enabling/disabling the creator's own public-profile consent — separate
 * from the per-protocol/per-challenge `visibility` toggle each manager page
 * has. Revoking takes effect immediately server-side (see
 * creators.service.ts's revokePublicProfileConsent): every one of this
 * user's Protocol/Challenge rows flips back to PRIVATE in the same
 * transaction, not just this flag.
 */
export function CreatorConsentToggle({
  initialConsent,
  userId,
}: {
  initialConsent: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(initialConsent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/creators/me/consent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: !consent }),
      });
      if (!response.ok) {
        setError('Could not update your public profile setting. Please try again.');
        return;
      }
      setConsent(!consent);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm">
          Public profile is currently <span className="font-medium">{consent ? 'enabled' : 'disabled'}</span>.
        </p>
        <Button type="button" variant={consent ? 'outline' : 'primary'} size="sm" disabled={busy} onClick={toggle}>
          {consent ? 'Disable public profile' : 'Enable public profile'}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      {consent && (
        <p className="text-sm text-muted-foreground">
          Your public page: <Link href={`/creators/${userId}`} className="text-primary underline">
            /creators/{userId}
          </Link>
          . Mark individual protocols/challenges Public from their own pages to publish them there.
        </p>
      )}
    </div>
  );
}

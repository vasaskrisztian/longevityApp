'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button, buttonVariants } from '@/components/ui/button';

/**
 * This page itself is public (no auth) — see creators/layout.tsx — but
 * following requires an account, so this client island is the only part
 * that needs to know whether a session exists. A logged-out visitor sees a
 * "Log in to follow" link instead of a disabled button.
 */
export function FollowButton({ creatorId }: { creatorId: string }) {
  const { data: session, status } = useSession();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    fetch(`/api/creators/${creatorId}/follow`)
      .then((r) => (r.ok ? r.json() : { following: false }))
      .then((data) => {
        if (!cancelled) setFollowing(Boolean(data.following));
      })
      .catch(() => {
        if (!cancelled) setFollowing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, creatorId]);

  if (status === 'loading') return null;

  if (status !== 'authenticated') {
    return (
      <Link
        href={`/login?callbackUrl=/creators/${creatorId}`}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        Log in to follow
      </Link>
    );
  }

  if (session?.user?.id === creatorId) {
    return null;
  }

  async function toggle() {
    setBusy(true);
    try {
      const response = await fetch(`/api/creators/${creatorId}/follow`, {
        method: following ? 'DELETE' : 'POST',
      });
      if (response.ok) {
        setFollowing(!following);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={following ? 'outline' : 'primary'}
      size="sm"
      disabled={busy || following === null}
      onClick={toggle}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}

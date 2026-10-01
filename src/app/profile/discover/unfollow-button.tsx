'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function UnfollowButton({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const response = await fetch(`/api/creators/${creatorId}/follow`, { method: 'DELETE' });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleClick}>
      Unfollow
    </Button>
  );
}

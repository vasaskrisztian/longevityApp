'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createAdminGroup, listAdminGroups, type LogoUpload } from '@/lib/wellbeing/groups-api';
import { GroupLogo, LoadingLine } from './parts';
import { LogoPickerButton } from './logo-field';
import { useLoad } from './use-load';

function CreateGroupCard({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<{ upload: LogoUpload; preview: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('The group needs a name.');
    setBusy(true);
    setError(null);
    try {
      await createAdminGroup({ name: trimmed, ...(logo ? { logo: logo.upload } : {}) });
      setName('');
      setLogo(null);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the group.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New group</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={create} className="space-y-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input id="group-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <GroupLogo src={logo?.preview ?? null} size={56} />
            <LogoPickerButton onPicked={(upload, preview) => setLogo({ upload, preview })} onError={setError} />
            {logo && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setLogo(null)}>
                Remove logo
              </Button>
            )}
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create group'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Corporate wellbeing — admin: all groups + create. */
export function AdminGroupsList() {
  const { data, error, reload } = useLoad(listAdminGroups, []);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Create a group for a company or team, invite people by email and follow their challenges. People only appear
        here after they accepted the invitation and agreed to share their health data with the group.
      </p>
      <CreateGroupCard onCreated={reload} />
      {error && <Alert variant="destructive">{error}</Alert>}
      {!data && !error && <LoadingLine />}
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">No groups yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((group) => (
          <Link key={group.id} href={`/admin/groups/${group.id}`} className="block">
            <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-md">
              <GroupLogo logoUrl={group.logoUrl} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-semibold text-primary">{group.name}</p>
                <p className="text-sm text-muted-foreground">
                  {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                  {group.pendingInvitationCount > 0 ? ` · ${group.pendingInvitationCount} invited` : ''}
                  {` · ${group.challengeCount} ${group.challengeCount === 1 ? 'challenge' : 'challenges'}`}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

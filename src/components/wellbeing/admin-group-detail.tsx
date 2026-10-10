'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createAdminGroupChallenge,
  deleteAdminGroup,
  getAdminGroup,
  inviteToGroup,
  listAdminGroupChallenges,
  removeGroupMember,
  revokeGroupInvitation,
  updateAdminGroup,
  type GroupChallengeType,
  type GroupDetail,
  type InviteResult,
  type LogoUpload,
} from '@/lib/wellbeing/groups-api';
import {
  addDays,
  daysLeftLabel,
  displayName,
  formatDateRange,
  formatDay,
  parseEmails,
  providerLabel,
  teamStatusLine,
  timeAgo,
  todayDay,
} from '@/lib/wellbeing/format';
import { GroupLogo, LoadingLine, PageTitle, ProgressBar, StatusBadge } from './parts';
import { LogoPickerButton } from './logo-field';
import { useLoad } from './use-load';

function EditGroupCard({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const [name, setName] = useState(group.name);
  const [logo, setLogo] = useState<{ upload: LogoUpload; preview: string } | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('The group needs a name.');
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateAdminGroup(group.id, {
        name: trimmed,
        ...(logo ? { logo: logo.upload } : removeLogo ? { logo: null } : {}),
      });
      setLogo(null);
      setRemoveLogo(false);
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the group.');
    } finally {
      setSaving(false);
    }
  }

  const showCurrent = !logo && !removeLogo && group.logoUrl;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Group details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          {saved && <Alert variant="success">Saved.</Alert>}
          <div className="space-y-2">
            <Label htmlFor="edit-group-name">Group name</Label>
            <Input id="edit-group-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GroupLogo src={logo?.preview ?? null} logoUrl={showCurrent ? group.logoUrl : null} size={56} />
            <LogoPickerButton
              onPicked={(upload, preview) => {
                setLogo({ upload, preview });
                setRemoveLogo(false);
              }}
              onError={setError}
            />
            {(group.logoUrl || logo) && !removeLogo && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLogo(null);
                  setRemoveLogo(true);
                }}
              >
                Remove logo
              </Button>
            )}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function InviteCard({ groupId, onInvited }: { groupId: string; onInvited: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const emails = parseEmails(text);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (emails.length === 0) return setError('Enter at least one email address.');
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      setResults(await inviteToGroup(groupId, emails));
      setText('');
      onInvited();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not send the invitations.');
    } finally {
      setBusy(false);
    }
  }

  const invited = results?.filter((r) => r.outcome === 'invited').length ?? 0;
  const already = results?.filter((r) => r.outcome === 'already_member').map((r) => r.email) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite people</CardTitle>
        <CardDescription>
          They get an email with a link. Whoever accepts and registers (or signs in) joins the group and shows up below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={send} className="space-y-3">
          {error && <Alert variant="destructive">{error}</Alert>}
          {results && (
            <Alert variant="success">
              {`${invited} ${invited === 1 ? 'invitation' : 'invitations'} sent.${already.length ? ` Already members: ${already.join(', ')}.` : ''}`}
            </Alert>
          )}
          <Label htmlFor="invite-emails">Email addresses</Label>
          <Textarea
            id="invite-emails"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="anna@company.com, bela@company.com"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Separate addresses with commas, spaces or new lines.{emails.length ? ` ${emails.length} recognised.` : ''}
          </p>
          <Button type="submit" disabled={busy || emails.length === 0}>
            {busy ? 'Sending…' : 'Send invitations'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MembersCard({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);

  async function remove(userId: string, label: string) {
    if (!window.confirm(`Remove ${label}? They leave the group and its challenges, and you will no longer see their health data.`)) return;
    try {
      await removeGroupMember(group.id, userId);
      onChanged();
    } catch {
      setError('Could not remove the member.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members ({group.members.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Alert variant="destructive">{error}</Alert>}
        {group.members.length === 0 && (
          <p className="text-sm text-muted-foreground">Nobody has joined yet. People appear here once they accept their invitation.</p>
        )}
        {group.members.map((member) => (
          <div key={member.userId} className="flex items-center gap-3 border-t border-card-border pt-3 first:border-t-0 first:pt-0">
            <Link href={`/admin/groups/${group.id}/members/${member.userId}`} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{displayName(member)}</p>
                {member.fullName && <p className="truncate text-xs text-muted-foreground">{member.email}</p>}
                <p className="text-xs text-muted-foreground">
                  {member.connectedProviders.length
                    ? `${member.connectedProviders.map(providerLabel).join(', ')} · ${member.lastSyncAt ? `synced ${timeAgo(member.lastSyncAt)}` : 'not synced yet'}`
                    : 'No device connected'}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
            <Button size="sm" variant="ghost" onClick={() => remove(member.userId, displayName(member))}>
              Remove
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InvitationsCard({ group, onChanged }: { group: GroupDetail; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  if (group.invitations.length === 0) return null;

  async function act(id: string, action: () => Promise<unknown>, failure: string) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      onChanged();
    } catch {
      setError(failure);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitations not accepted yet ({group.invitations.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Alert variant="destructive">{error}</Alert>}
        {group.invitations.map((invitation) => (
          <div key={invitation.id} className="flex items-center gap-3 border-t border-card-border pt-3 first:border-t-0 first:pt-0">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{invitation.email}</p>
              <p className={invitation.state === 'EXPIRED' ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
                {invitation.state === 'EXPIRED' ? 'Expired' : 'Waiting'} · sent {timeAgo(invitation.sentAt)}
                {invitation.state === 'PENDING' ? ` · valid until ${formatDay(invitation.expiresAt.slice(0, 10))}` : ''}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === invitation.id}
              onClick={() => act(invitation.id, () => inviteToGroup(group.id, [invitation.email]), 'Could not resend the invitation.')}
            >
              Resend
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === invitation.id}
              onClick={() => act(invitation.id, () => revokeGroupInvitation(group.id, invitation.id), 'Could not cancel the invitation.')}
            >
              Cancel
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const TYPE_FIELDS: Record<GroupChallengeType, { label: string; threshold: string; count: string; hint: string; defaults: [string, string] }> = {
  DAILY_STEPS: {
    label: 'Daily steps',
    threshold: 'Steps per day (more than)',
    count: 'Number of days',
    hint: 'A day counts when the steps are above the limit.',
    defaults: ['8000', '10'],
  },
  SLEEP_SCORE: {
    label: 'Sleep score',
    threshold: 'Sleep score (above)',
    count: 'Number of nights',
    hint: 'A night counts when the sleep score is above the limit.',
    defaults: ['80', '10'],
  },
  WEEKLY_WORKOUTS: {
    label: 'Weekly workouts',
    threshold: 'Workouts per week (more than)',
    count: 'Number of weeks',
    hint: 'A week counts when the person logged more workouts than the limit.',
    defaults: ['2', '4'],
  },
};

function NewChallengeCard({ groupId, onCreated }: { groupId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GroupChallengeType>('DAILY_STEPS');
  const [threshold, setThreshold] = useState('8000');
  const [requiredCount, setRequiredCount] = useState('10');
  const [startDate, setStartDate] = useState(todayDay());
  const [endDate, setEndDate] = useState(addDays(todayDay(), 29));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function changeType(value: GroupChallengeType) {
    setType(value);
    setThreshold(TYPE_FIELDS[value].defaults[0]);
    setRequiredCount(TYPE_FIELDS[value].defaults[1]);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Give the challenge a name.';
    const thresholdNumber = Number(threshold);
    const countNumber = Number(requiredCount);
    if (!Number.isInteger(thresholdNumber) || thresholdNumber < 1) next.threshold = 'Enter a whole number, at least 1.';
    if (!Number.isInteger(countNumber) || countNumber < 1) next.requiredCount = 'Enter a whole number, at least 1.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) next.startDate = 'Pick a date.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) next.endDate = 'Pick a date.';
    if (!next.startDate && !next.endDate && endDate < startDate) next.endDate = 'The end cannot be before the start.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setServerError(null);
    try {
      await createAdminGroupChallenge(groupId, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        type,
        threshold: thresholdNumber,
        requiredCount: countNumber,
        startDate,
        endDate,
      });
      setName('');
      setDescription('');
      setOpen(false);
      onCreated();
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : 'Could not create the challenge.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        New challenge
      </Button>
    );
  }
  const fields = TYPE_FIELDS[type];
  const err = (key: string) => (errors[key] ? <p className="text-sm text-danger">{errors[key]}</p> : null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>New challenge</CardTitle>
        <CardDescription>Every member gets an in-app notification and can join voluntarily.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={create} className="space-y-4">
          {serverError && <Alert variant="destructive">{serverError}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="ch-name">Name</Label>
            <Input id="ch-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
            {err('name')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-desc">Description (optional)</Label>
            <Textarea id="ch-desc" value={description} maxLength={1000} rows={2} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-type">Type</Label>
            <Select id="ch-type" value={type} onChange={(e) => changeType(e.target.value as GroupChallengeType)}>
              {(Object.keys(TYPE_FIELDS) as GroupChallengeType[]).map((key) => (
                <option key={key} value={key}>
                  {TYPE_FIELDS[key].label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{fields.hint}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ch-threshold">{fields.threshold}</Label>
              <Input id="ch-threshold" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
              {err('threshold')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-count">{fields.count}</Label>
              <Input id="ch-count" inputMode="numeric" value={requiredCount} onChange={(e) => setRequiredCount(e.target.value)} />
              {err('requiredCount')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-start">First day</Label>
              <Input id="ch-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              {err('startDate')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-end">Last day</Label>
              <Input id="ch-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {err('endDate')}
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create challenge'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Corporate wellbeing — admin: one group (details, invitations, members, challenges). */
export function AdminGroupDetail({ groupId }: { groupId: string }) {
  const router = useRouter();
  const group = useLoad(() => getAdminGroup(groupId), [groupId]);
  const challenges = useLoad(() => listAdminGroupChallenges(groupId), [groupId]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reloadAll = () => {
    group.reload();
    challenges.reload();
  };

  async function removeGroup() {
    if (!group.data) return;
    if (
      !window.confirm(
        `Delete "${group.data.name}"? Members, invitations and challenges of this group are removed. People keep their accounts and health data.`,
      )
    )
      return;
    try {
      await deleteAdminGroup(groupId);
      router.push('/admin/groups');
    } catch {
      setDeleteError('Could not delete the group.');
    }
  }

  if (group.error) return <Alert variant="destructive">{group.error}</Alert>;
  if (!group.data) return <LoadingLine />;
  const data = group.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <GroupLogo logoUrl={data.logoUrl} size={64} />
        <div>
          <PageTitle>{data.name}</PageTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.members.length} {data.members.length === 1 ? 'member' : 'members'}
            {data.invitations.length ? ` · ${data.invitations.length} invitations waiting` : ''}
          </p>
        </div>
      </div>

      <MembersCard group={data} onChanged={reloadAll} />
      <InvitationsCard group={data} onChanged={reloadAll} />
      <InviteCard groupId={groupId} onInvited={reloadAll} />

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-primary">Challenges</h2>
        <NewChallengeCard groupId={groupId} onCreated={reloadAll} />
        {!challenges.data && !challenges.error && <LoadingLine />}
        {challenges.data && challenges.data.length === 0 && <p className="text-sm text-muted-foreground">No challenges yet.</p>}
        {challenges.data?.map((challenge) => (
          <Link key={challenge.id} href={`/admin/groups/${groupId}/challenges/${challenge.id}`} className="block">
            <Card className="space-y-2 p-5 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{challenge.name}</p>
                <StatusBadge status={challenge.status} />
              </div>
              <p className="text-sm">{challenge.target}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateRange(challenge.startDate, challenge.endDate)}
                {daysLeftLabel(challenge.daysRemaining) ? ` · ${daysLeftLabel(challenge.daysRemaining)}` : ''}
              </p>
              <ProgressBar percent={challenge.team.averagePercent} />
              <p className="text-xs text-muted-foreground">{teamStatusLine(challenge.team)}</p>
              <p className="text-xs text-muted-foreground">
                {challenge.team.participants} of {challenge.team.members} members joined
              </p>
            </Card>
          </Link>
        ))}
      </section>

      <EditGroupCard key={`${data.name}-${data.logoUrl}`} group={data} onChanged={reloadAll} />

      <Card>
        <CardHeader>
          <CardTitle>Delete group</CardTitle>
          <CardDescription>Removes the group with its members, invitations and challenges. Accounts and health data stay.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deleteError && <Alert variant="destructive">{deleteError}</Alert>}
          <Button variant="destructive" onClick={removeGroup}>
            Delete group
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

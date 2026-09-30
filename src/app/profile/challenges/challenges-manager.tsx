'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateChallengeSchema, ChallengeTypeEnum } from '@/lib/validation/challenge.schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

export type ChallengeType = 'SLEEP_SCORE' | 'DAILY_STEPS' | 'WEEKLY_WORKOUTS';
export type ChallengeStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface ChallengeProgressDTO {
  status: ChallengeStatus;
  currentCount: number;
  requiredCount: number;
  daysRemaining: number | null;
}

export interface ChallengeDTO {
  id: string;
  type: ChallengeType;
  name?: string | null;
  requiredCount: number;
  threshold: number;
  windowDays: number;
  activatedAt: string | null;
  expiresAt: string | null;
  progress: ChallengeProgressDTO;
}

// Per-type copy for the form and the read-only summary line — the same
// three fields (requiredCount/threshold/windowDays) mean something
// different depending on what metric the challenge tracks.
const CHALLENGE_TYPE_META: Record<
  ChallengeType,
  { label: string; periodNoun: string; thresholdLabel: string; thresholdUnit: string }
> = {
  SLEEP_SCORE: {
    label: 'Sleep score',
    periodNoun: 'nights',
    thresholdLabel: 'Sleep score above',
    thresholdUnit: 'points',
  },
  DAILY_STEPS: {
    label: 'Daily steps',
    periodNoun: 'days',
    thresholdLabel: 'Steps above',
    thresholdUnit: 'steps',
  },
  WEEKLY_WORKOUTS: {
    label: 'Weekly workouts',
    periodNoun: 'weeks',
    thresholdLabel: 'Workouts above',
    thresholdUnit: 'per week',
  },
};

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

// ACTIVE reuses the exact "Active" badge style Protocols already uses for
// its own active row, so the same visual language means the same thing
// across both features.
const STATUS_BADGE_CLASS: Record<ChallengeStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-gradient-to-r from-primary to-primary-dark text-primary-foreground',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
};

function describeTerms(c: Pick<ChallengeDTO, 'type' | 'requiredCount' | 'threshold' | 'windowDays'>): string {
  const meta = CHALLENGE_TYPE_META[c.type];
  return `${meta.thresholdLabel} ${c.threshold} ${meta.thresholdUnit}, for ${c.requiredCount} ${meta.periodNoun}, within ${c.windowDays} days of activation`;
}

function progressSummary(c: ChallengeDTO): string {
  const meta = CHALLENGE_TYPE_META[c.type];
  const { status, currentCount, requiredCount, daysRemaining } = c.progress;
  if (status === 'DRAFT') return 'Not started yet.';
  if (status === 'ACTIVE') {
    return `${currentCount}/${requiredCount} ${meta.periodNoun} so far · ${daysRemaining} day${
      daysRemaining === 1 ? '' : 's'
    } left`;
  }
  if (status === 'COMPLETED') {
    return `${currentCount}/${requiredCount} ${meta.periodNoun} reached.`;
  }
  return `Only ${currentCount}/${requiredCount} ${meta.periodNoun} reached before the deadline.`;
}

const ChallengeFormSchema = CreateChallengeSchema;
type ChallengeFormValues = z.infer<typeof ChallengeFormSchema>;

const EMPTY_FORM: Partial<ChallengeFormValues> = { type: 'SLEEP_SCORE' };

function ChallengeForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Partial<ChallengeFormValues>;
  onCancel?: () => void;
  onSaved: (data: ChallengeFormValues) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChallengeFormValues>({
    resolver: zodResolver(ChallengeFormSchema),
    defaultValues: initial,
  });
  const selectedType = watch('type') as ChallengeType | undefined;
  const meta = (selectedType && CHALLENGE_TYPE_META[selectedType]) || CHALLENGE_TYPE_META.SLEEP_SCORE;

  async function submit(data: ChallengeFormValues) {
    setServerError(null);
    setSubmitting(true);
    try {
      await onSaved(data);
    } catch {
      setServerError('Could not save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {serverError && <Alert variant="destructive">{serverError}</Alert>}

      <div className="space-y-1">
        <Label htmlFor="type">Challenge type</Label>
        <Select id="type" {...register('type')}>
          {ChallengeTypeEnum.options.map((value) => (
            <option key={value} value={value}>
              {CHALLENGE_TYPE_META[value].label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="name">Name (optional)</Label>
        <Input id="name" placeholder="e.g. 10 great nights" {...register('name')} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="threshold">
            {meta.thresholdLabel} ({meta.thresholdUnit})
          </Label>
          <Input id="threshold" type="number" {...register('threshold')} />
          {errors.threshold && <p className="text-sm text-danger">{errors.threshold.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="requiredCount">Number of {meta.periodNoun} to hit</Label>
          <Input id="requiredCount" type="number" {...register('requiredCount')} />
          {errors.requiredCount && <p className="text-sm text-danger">{errors.requiredCount.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="windowDays">Challenge length (days)</Label>
          <Input id="windowDays" type="number" {...register('windowDays')} />
          {errors.windowDays && <p className="text-sm text-danger">{errors.windowDays.message}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function ProgressBar({ current, required }: { current: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ChallengeRow({
  challenge,
  onUpdated,
  onDeleted,
}: {
  challenge: ChallengeDTO;
  onUpdated: (c: ChallengeDTO) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const { status } = challenge.progress;
  const isDraft = status === 'DRAFT';

  async function handleSave(data: ChallengeFormValues) {
    const response = await fetch(`/api/challenges/${challenge.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('save failed');
    const updated = await response.json();
    onUpdated(toDTO(updated));
    setEditing(false);
  }

  async function handleActivate() {
    setActivating(true);
    const response = await fetch(`/api/challenges/${challenge.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activate: true }),
    });
    setActivating(false);
    if (response.ok) {
      const updated = await response.json();
      onUpdated(toDTO(updated));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const response = await fetch(`/api/challenges/${challenge.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (response.ok || response.status === 204) {
      onDeleted();
    }
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="p-4">
          <ChallengeForm
            initial={{
              type: challenge.type,
              name: challenge.name ?? undefined,
              requiredCount: challenge.requiredCount,
              threshold: challenge.threshold,
              windowDays: challenge.windowDays,
            }}
            onCancel={() => setEditing(false)}
            onSaved={handleSave}
          />
        </CardContent>
      </Card>
    );
  }

  const cardAccent =
    status === 'ACTIVE'
      ? 'border-primary shadow-glow'
      : status === 'COMPLETED'
        ? 'border-success/40'
        : status === 'FAILED'
          ? 'border-danger/40'
          : undefined;

  return (
    <Card className={cardAccent}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {challenge.name || CHALLENGE_TYPE_META[challenge.type].label}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                {STATUS_LABEL[status]}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">{describeTerms(challenge)}</p>
            {!isDraft && (
              <div className="mt-2 max-w-xs space-y-1">
                <ProgressBar current={challenge.progress.currentCount} required={challenge.progress.requiredCount} />
                <p className="text-sm text-muted-foreground">{progressSummary(challenge)}</p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {isDraft && (
              <Button size="sm" onClick={handleActivate} disabled={activating}>
                {activating ? 'Starting…' : 'Start challenge'}
              </Button>
            )}
            <div className="flex gap-2">
              {isDraft && (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDTO(raw: any): ChallengeDTO {
  return {
    id: raw.id,
    type: raw.type,
    name: raw.name ?? null,
    requiredCount: raw.requiredCount,
    threshold: raw.threshold,
    windowDays: raw.windowDays,
    activatedAt: raw.activatedAt ?? null,
    expiresAt: raw.expiresAt ?? null,
    progress: raw.progress,
  };
}

export function ChallengesManager({ initial }: { initial: ChallengeDTO[] }) {
  const [challenges, setChallenges] = useState(initial);
  const [adding, setAdding] = useState(false);

  async function handleCreate(data: ChallengeFormValues) {
    const response = await fetch('/api/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('create failed');
    const created = await response.json();
    setChallenges((prev) => [toDTO(created), ...prev]);
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <Card>
          <CardContent className="p-4">
            <ChallengeForm initial={EMPTY_FORM} onCancel={() => setAdding(false)} onSaved={handleCreate} />
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" onClick={() => setAdding(true)}>
          Add challenge
        </Button>
      )}

      {challenges.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No challenges yet.</p>
      )}

      <div className="space-y-3">
        {challenges.map((challenge) => (
          <ChallengeRow
            key={challenge.id}
            challenge={challenge}
            onUpdated={(updated) =>
              setChallenges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
            }
            onDeleted={() => setChallenges((prev) => prev.filter((c) => c.id !== challenge.id))}
          />
        ))}
      </div>
    </div>
  );
}

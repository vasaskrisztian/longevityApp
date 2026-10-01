'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateProtocolSchema } from '@/lib/validation/protocol.schemas';
import { SupplementFrequencyEnum, SupplementTimingEnum } from '@/lib/validation/supplement.schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

export interface ProtocolSupplementDTO {
  name: string;
  dosage?: number | null;
  unit?: string | null;
  frequency?: string | null;
  timing?: string | null;
}

export interface ProtocolDTO {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  targetSleepScore?: number | null;
  targetSleepMinutes?: number | null;
  targetWeeklyWorkouts?: number | null;
  targetDailyActiveCalories?: number | null;
  visibility: 'PRIVATE' | 'PUBLIC';
  supplements: ProtocolSupplementDTO[];
}

// isActive is deliberately not a form field — a protocol is always created
// inactive and switched on afterward from its own "Set as active" button in
// the list, one click that never touches the rest of the plan's data (see
// ProtocolRow's handleActivate).
const ProtocolFormSchema = CreateProtocolSchema.omit({ isActive: true });
type ProtocolFormValues = z.infer<typeof ProtocolFormSchema>;

const EMPTY_FORM: ProtocolFormValues = {
  name: '',
  supplements: [],
};

function formatMinutes(totalMinutes: number | null | undefined): string | null {
  if (totalMinutes === null || totalMinutes === undefined) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function ProtocolForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ProtocolFormValues;
  onCancel?: () => void;
  onSaved: (data: ProtocolFormValues) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProtocolFormValues>({
    resolver: zodResolver(ProtocolFormSchema),
    defaultValues: initial,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'supplements' });

  async function submit(data: ProtocolFormValues) {
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
        <Label htmlFor="name">Protocol name</Label>
        <Input id="name" placeholder="e.g. Base building" {...register('name')} />
        {errors.name && <p className="text-sm text-danger">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" rows={2} {...register('description')} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Targets</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="targetSleepScore">Target sleep score (0–100)</Label>
            <Input id="targetSleepScore" type="number" {...register('targetSleepScore')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="targetSleepMinutes">Target sleep duration (minutes)</Label>
            <Input id="targetSleepMinutes" type="number" {...register('targetSleepMinutes')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="targetWeeklyWorkouts">Target workouts per week</Label>
            <Input id="targetWeeklyWorkouts" type="number" {...register('targetWeeklyWorkouts')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="targetDailyActiveCalories">Target daily active calories</Label>
            <Input id="targetDailyActiveCalories" type="number" {...register('targetDailyActiveCalories')} />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Supplements</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ name: '' })}
          >
            Add supplement
          </Button>
        </div>
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">No supplements added to this protocol.</p>
        )}
        <div className="space-y-3">
          {fields.map((field: { id: string }, index: number) => (
            <Card key={field.id}>
              <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`supplements.${index}.name`}>Name</Label>
                  <Input id={`supplements.${index}.name`} {...register(`supplements.${index}.name` as const)} />
                  {errors.supplements?.[index]?.name && (
                    <p className="text-sm text-danger">{errors.supplements[index]?.name?.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`supplements.${index}.dosage`}>Dosage</Label>
                    <Input
                      id={`supplements.${index}.dosage`}
                      type="number"
                      step="0.01"
                      {...register(`supplements.${index}.dosage` as const)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`supplements.${index}.unit`}>Unit</Label>
                    <Input id={`supplements.${index}.unit`} {...register(`supplements.${index}.unit` as const)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`supplements.${index}.frequency`}>Frequency</Label>
                    <Select id={`supplements.${index}.frequency`} {...register(`supplements.${index}.frequency` as const)}>
                      <option value="">—</option>
                      {SupplementFrequencyEnum.options.map((value) => (
                        <option key={value} value={value}>
                          {value.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`supplements.${index}.timing`}>Timing</Label>
                    <Select id={`supplements.${index}.timing`} {...register(`supplements.${index}.timing` as const)}>
                      <option value="">—</option>
                      {SupplementTimingEnum.options.map((value) => (
                        <option key={value} value={value}>
                          {value.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Button type="button" size="sm" variant="destructive" onClick={() => remove(index)}>
                    Remove supplement
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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

function ProtocolRow({
  protocol,
  canPublish,
  onUpdated,
  onDeleted,
  onActivated,
}: {
  protocol: ProtocolDTO;
  canPublish: boolean;
  onUpdated: (p: ProtocolDTO) => void;
  onDeleted: () => void;
  onActivated: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  // Phase 13: a separate, single-field PATCH — same pattern as
  // handleActivate below — so publishing never touches the rest of the
  // protocol's data and never goes through the full edit form.
  async function handleToggleVisibility() {
    setTogglingVisibility(true);
    const nextVisibility = protocol.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    const response = await fetch(`/api/protocols/${protocol.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: nextVisibility }),
    });
    setTogglingVisibility(false);
    if (response.ok) {
      const updated = await response.json();
      onUpdated(toDTO(updated));
    }
  }

  async function handleSave(data: ProtocolFormValues) {
    const response = await fetch(`/api/protocols/${protocol.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('save failed');
    const updated = await response.json();
    onUpdated(toDTO(updated));
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const response = await fetch(`/api/protocols/${protocol.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (response.ok || response.status === 204) {
      onDeleted();
    }
  }

  async function handleActivate() {
    setActivating(true);
    const response = await fetch(`/api/protocols/${protocol.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    });
    setActivating(false);
    if (response.ok) {
      onActivated(protocol.id);
    }
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="p-4">
          <ProtocolForm
            initial={{
              name: protocol.name,
              description: protocol.description ?? undefined,
              targetSleepScore: protocol.targetSleepScore ?? undefined,
              targetSleepMinutes: protocol.targetSleepMinutes ?? undefined,
              targetWeeklyWorkouts: protocol.targetWeeklyWorkouts ?? undefined,
              targetDailyActiveCalories: protocol.targetDailyActiveCalories ?? undefined,
              supplements: protocol.supplements.map((s) => ({
                name: s.name,
                dosage: s.dosage ?? undefined,
                unit: s.unit ?? undefined,
                frequency: (s.frequency ?? undefined) as ProtocolFormValues['supplements'][number]['frequency'],
                timing: (s.timing ?? undefined) as ProtocolFormValues['supplements'][number]['timing'],
              }))}
            }
            onCancel={() => setEditing(false)}
            onSaved={handleSave}
          />
        </CardContent>
      </Card>
    );
  }

  const targets = [
    protocol.targetSleepScore != null ? `Sleep score ≥ ${protocol.targetSleepScore}` : null,
    formatMinutes(protocol.targetSleepMinutes) ? `Sleep ${formatMinutes(protocol.targetSleepMinutes)}` : null,
    protocol.targetWeeklyWorkouts != null ? `${protocol.targetWeeklyWorkouts} workouts/week` : null,
    protocol.targetDailyActiveCalories != null
      ? `${protocol.targetDailyActiveCalories} active kcal/day`
      : null,
  ].filter(Boolean);

  return (
    <Card className={protocol.isActive ? 'border-primary shadow-glow' : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-medium">
              {protocol.name}
              {protocol.isActive && (
                <span className="rounded-full bg-gradient-to-r from-primary to-primary-dark px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Active
                </span>
              )}
              {protocol.visibility === 'PUBLIC' && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  Public
                </span>
              )}
            </p>
            {protocol.description && (
              <p className="text-sm text-muted-foreground">{protocol.description}</p>
            )}
            {targets.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">{targets.join(' · ')}</p>
            )}
            {protocol.supplements.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Supplements: {protocol.supplements.map((s) => s.name).join(', ')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {!protocol.isActive && (
              <Button size="sm" onClick={handleActivate} disabled={activating}>
                {activating ? 'Setting…' : 'Set as active'}
              </Button>
            )}
            {canPublish && (
              <Button size="sm" variant="outline" onClick={handleToggleVisibility} disabled={togglingVisibility}>
                {togglingVisibility
                  ? 'Updating…'
                  : protocol.visibility === 'PUBLIC'
                    ? 'Make private'
                    : 'Publish publicly'}
              </Button>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
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

// The API returns Decimal fields (supplement dosage) as strings/Decimal-like
// values over the wire once JSON-serialized by Response.json — normalize
// them to plain numbers the same way GoalsManager/SupplementsManager do.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDTO(raw: any): ProtocolDTO {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    isActive: raw.isActive,
    targetSleepScore: raw.targetSleepScore ?? null,
    targetSleepMinutes: raw.targetSleepMinutes ?? null,
    targetWeeklyWorkouts: raw.targetWeeklyWorkouts ?? null,
    targetDailyActiveCalories: raw.targetDailyActiveCalories ?? null,
    visibility: raw.visibility ?? 'PRIVATE',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supplements: (raw.supplements ?? []).map((s: any) => ({
      name: s.name,
      dosage: s.dosage === null || s.dosage === undefined ? null : Number(s.dosage),
      unit: s.unit ?? null,
      frequency: s.frequency ?? null,
      timing: s.timing ?? null,
    })),
  };
}

export function ProtocolsManager({
  initial,
  canPublish,
}: {
  initial: ProtocolDTO[];
  canPublish: boolean;
}) {
  const [protocols, setProtocols] = useState(initial);
  const [adding, setAdding] = useState(false);

  async function handleCreate(data: ProtocolFormValues) {
    const response = await fetch('/api/protocols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('create failed');
    const created = await response.json();
    setProtocols((prev) => [toDTO(created), ...prev]);
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <Card>
          <CardContent className="p-4">
            <ProtocolForm initial={EMPTY_FORM} onCancel={() => setAdding(false)} onSaved={handleCreate} />
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" onClick={() => setAdding(true)}>
          Add protocol
        </Button>
      )}

      {protocols.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No protocols yet.</p>
      )}

      <div className="space-y-3">
        {protocols.map((protocol) => (
          <ProtocolRow
            key={protocol.id}
            protocol={protocol}
            canPublish={canPublish}
            onUpdated={(updated) =>
              setProtocols((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            }
            onDeleted={() => setProtocols((prev) => prev.filter((p) => p.id !== protocol.id))}
            onActivated={(id) =>
              setProtocols((prev) => prev.map((p) => ({ ...p, isActive: p.id === id })))
            }
          />
        ))}
      </div>
    </div>
  );
}

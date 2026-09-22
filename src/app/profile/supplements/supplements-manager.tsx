'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateSupplementSchema,
  SupplementFrequencyEnum,
  SupplementTimingEnum,
  type CreateSupplementInput,
} from '@/lib/validation/supplement.schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

export interface SupplementDTO {
  id: string;
  name: string;
  dosage: number;
  unit: string;
  frequency: string;
  timing?: string | null;
  notes?: string | null;
  active: boolean;
}

const EMPTY_FORM: CreateSupplementInput = {
  name: '',
  dosage: 0,
  unit: 'mg',
  frequency: 'DAILY',
  active: true,
};

function SupplementForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: CreateSupplementInput;
  onCancel?: () => void;
  onSaved: (data: CreateSupplementInput) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSupplementInput>({
    resolver: zodResolver(CreateSupplementSchema),
    defaultValues: initial,
  });

  async function submit(data: CreateSupplementInput) {
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
    <form onSubmit={handleSubmit(submit)} className="space-y-3">
      {serverError && <Alert variant="destructive">{serverError}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-sm text-danger">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="dosage">Dosage</Label>
            <Input id="dosage" type="number" step="0.01" {...register('dosage')} />
            {errors.dosage && <p className="text-sm text-danger">{errors.dosage.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" placeholder="mg" {...register('unit')} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="frequency">Frequency</Label>
          <Select id="frequency" {...register('frequency')}>
            {SupplementFrequencyEnum.options.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="timing">Timing (optional)</Label>
          <Select id="timing" defaultValue="" {...register('timing')}>
            <option value="">—</option>
            {SupplementTimingEnum.options.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" {...register('notes')} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('active')} />
        Active
      </label>
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

function SupplementRow({
  supplement,
  onUpdated,
  onDeleted,
}: {
  supplement: SupplementDTO;
  onUpdated: (s: SupplementDTO) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(data: CreateSupplementInput) {
    const response = await fetch(`/api/supplements/${supplement.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('save failed');
    const updated = await response.json();
    onUpdated({ ...updated, dosage: Number(updated.dosage) });
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const response = await fetch(`/api/supplements/${supplement.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (response.ok || response.status === 204) {
      onDeleted();
    }
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="p-4">
          <SupplementForm
            initial={{
              name: supplement.name,
              dosage: supplement.dosage,
              unit: supplement.unit,
              frequency: supplement.frequency as CreateSupplementInput['frequency'],
              timing: (supplement.timing ?? undefined) as CreateSupplementInput['timing'],
              notes: supplement.notes ?? undefined,
              active: supplement.active,
            }}
            onCancel={() => setEditing(false)}
            onSaved={handleSave}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="font-medium">
            {supplement.name}
            {!supplement.active && (
              <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {supplement.dosage}
            {supplement.unit} · {supplement.frequency.replaceAll('_', ' ')}
            {supplement.timing ? ` · ${supplement.timing.replaceAll('_', ' ')}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SupplementsManager({ initial }: { initial: SupplementDTO[] }) {
  const [supplements, setSupplements] = useState(initial);
  const [adding, setAdding] = useState(false);

  async function handleCreate(data: CreateSupplementInput) {
    const response = await fetch('/api/supplements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('create failed');
    const created = await response.json();
    setSupplements((prev) => [{ ...created, dosage: Number(created.dosage) }, ...prev]);
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <Card>
          <CardContent className="p-4">
            <SupplementForm
              initial={EMPTY_FORM}
              onCancel={() => setAdding(false)}
              onSaved={handleCreate}
            />
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" onClick={() => setAdding(true)}>
          Add supplement
        </Button>
      )}

      {supplements.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No supplements yet.</p>
      )}

      <div className="space-y-3">
        {supplements.map((supplement) => (
          <SupplementRow
            key={supplement.id}
            supplement={supplement}
            onUpdated={(updated) =>
              setSupplements((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
            }
            onDeleted={() =>
              setSupplements((prev) => prev.filter((s) => s.id !== supplement.id))
            }
          />
        ))}
      </div>
    </div>
  );
}

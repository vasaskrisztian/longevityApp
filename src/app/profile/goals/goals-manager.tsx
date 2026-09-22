'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateGoalSchema, GoalTypeEnum, GoalStatusEnum } from '@/lib/validation/goal.schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

export interface GoalDTO {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  targetValue?: number | null;
  targetUnit?: string | null;
  targetDate?: string | null; // "yyyy-mm-dd" or null
  status: string;
}

// targetDate is edited as a plain "yyyy-mm-dd" string (what <input
// type="date"> produces); CreateGoalSchema's z.coerce.date() turns that
// into a real Date server-side — see PersonalInfoForm for the same pattern.
const GoalFormSchema = CreateGoalSchema.extend({
  targetDate: z.string().optional(),
});
type GoalFormValues = z.infer<typeof GoalFormSchema>;

const EMPTY_FORM: GoalFormValues = {
  type: 'GENERAL_HEALTH',
  name: '',
  status: 'ACTIVE',
};

function GoalForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: GoalFormValues;
  onCancel?: () => void;
  onSaved: (data: GoalFormValues) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(GoalFormSchema),
    defaultValues: initial,
  });

  async function submit(data: GoalFormValues) {
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
        <div className="space-y-1">
          <Label htmlFor="type">Type</Label>
          <Select id="type" {...register('type')}>
            {GoalTypeEnum.options.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="targetValue">Target value (optional)</Label>
            <Input id="targetValue" type="number" step="0.01" {...register('targetValue')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="targetUnit">Unit (optional)</Label>
            <Input id="targetUnit" {...register('targetUnit')} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="targetDate">Target date (optional)</Label>
          <Input id="targetDate" type="date" {...register('targetDate')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register('status')}>
            {GoalStatusEnum.options.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" {...register('description')} />
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

function GoalRow({
  goal,
  onUpdated,
  onDeleted,
}: {
  goal: GoalDTO;
  onUpdated: (g: GoalDTO) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(data: GoalFormValues) {
    const response = await fetch(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('save failed');
    const updated = await response.json();
    onUpdated({
      ...updated,
      targetValue: updated.targetValue === null ? null : Number(updated.targetValue),
      targetDate: updated.targetDate ? String(updated.targetDate).slice(0, 10) : null,
    });
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const response = await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (response.ok || response.status === 204) {
      onDeleted();
    }
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="p-4">
          <GoalForm
            initial={{
              type: goal.type as GoalFormValues['type'],
              name: goal.name,
              description: goal.description ?? undefined,
              targetValue: goal.targetValue ?? undefined,
              targetUnit: goal.targetUnit ?? undefined,
              targetDate: goal.targetDate ?? undefined,
              status: goal.status as GoalFormValues['status'],
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
          <p className="font-medium">{goal.name}</p>
          <p className="text-sm text-muted-foreground">
            {goal.type.replaceAll('_', ' ')} · {goal.status.replaceAll('_', ' ')}
            {goal.targetValue != null ? ` · target ${goal.targetValue}${goal.targetUnit ?? ''}` : ''}
            {goal.targetDate ? ` · by ${goal.targetDate}` : ''}
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

export function GoalsManager({ initial }: { initial: GoalDTO[] }) {
  const [goals, setGoals] = useState(initial);
  const [adding, setAdding] = useState(false);

  async function handleCreate(data: GoalFormValues) {
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('create failed');
    const created = await response.json();
    setGoals((prev) => [
      {
        ...created,
        targetValue: created.targetValue === null ? null : Number(created.targetValue),
        targetDate: created.targetDate ? String(created.targetDate).slice(0, 10) : null,
      },
      ...prev,
    ]);
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <Card>
          <CardContent className="p-4">
            <GoalForm initial={EMPTY_FORM} onCancel={() => setAdding(false)} onSaved={handleCreate} />
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" onClick={() => setAdding(true)}>
          Add goal
        </Button>
      )}

      {goals.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No goals yet.</p>
      )}

      <div className="space-y-3">
        {goals.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            onUpdated={(updated) =>
              setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
            }
            onDeleted={() => setGoals((prev) => prev.filter((g) => g.id !== goal.id))}
          />
        ))}
      </div>
    </div>
  );
}

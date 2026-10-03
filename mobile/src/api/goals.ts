import { apiFetch, apiFetchJson } from '@/src/api/client';
import type { CreateGoalInput } from '@/src/validation/schemas';

/** Raw wire shape — targetValue is a Prisma Decimal (serializes as a
 * string), targetDate a full ISO datetime string. Mirrors the web app's
 * goals-manager.tsx conversion exactly. */
interface RawGoal {
  id: string;
  type: string;
  name: string;
  description: string | null;
  targetValue: string | null;
  targetUnit: string | null;
  targetDate: string | null;
  status: string;
}

export interface Goal {
  id: string;
  type: string;
  name: string;
  description: string | null;
  targetValue: number | null;
  targetUnit: string | null;
  /** Plain yyyy-mm-dd, or null. */
  targetDate: string | null;
  status: string;
}

function toGoal(raw: RawGoal): Goal {
  return {
    ...raw,
    targetValue: raw.targetValue === null ? null : Number(raw.targetValue),
    targetDate: raw.targetDate ? raw.targetDate.slice(0, 10) : null,
  };
}

export async function listGoals(): Promise<Goal[]> {
  const raw = await apiFetchJson<RawGoal[]>('/api/goals');
  return raw.map(toGoal);
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const response = await apiFetch('/api/goals', { method: 'POST', body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`Failed to create goal (${response.status}).`);
  return toGoal(await response.json());
}

export async function updateGoal(id: string, input: Partial<CreateGoalInput>): Promise<Goal> {
  const response = await apiFetch(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`Failed to update goal (${response.status}).`);
  return toGoal(await response.json());
}

export async function deleteGoal(id: string): Promise<void> {
  const response = await apiFetch(`/api/goals/${id}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete goal (${response.status}).`);
  }
}

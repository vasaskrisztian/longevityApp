import { apiFetch, apiFetchJson } from '@/src/api/client';
import type { CreateProtocolInput } from '@/src/validation/schemas';

/** Raw wire shape — ProtocolSupplement.dosage is a Prisma Decimal column,
 * which Response.json() serializes as a string, same as goals.ts/
 * supplements.ts's dosage/targetValue conversions. */
interface RawProtocolSupplement {
  name: string;
  dosage: string | number | null;
  unit: string | null;
  frequency: string | null;
  timing: string | null;
}

interface RawProtocol {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  targetSleepScore: number | null;
  targetSleepMinutes: number | null;
  targetWeeklyWorkouts: number | null;
  targetDailyActiveCalories: number | null;
  visibility: 'PRIVATE' | 'PUBLIC';
  supplements: RawProtocolSupplement[];
}

export interface ProtocolSupplement {
  name: string;
  dosage: number | null;
  unit: string | null;
  frequency: string | null;
  timing: string | null;
}

export interface Protocol {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  targetSleepScore: number | null;
  targetSleepMinutes: number | null;
  targetWeeklyWorkouts: number | null;
  targetDailyActiveCalories: number | null;
  visibility: 'PRIVATE' | 'PUBLIC';
  supplements: ProtocolSupplement[];
}

function toProtocol(raw: RawProtocol): Protocol {
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
    supplements: (raw.supplements ?? []).map((s) => ({
      name: s.name,
      dosage: s.dosage === null || s.dosage === undefined ? null : Number(s.dosage),
      unit: s.unit ?? null,
      frequency: s.frequency ?? null,
      timing: s.timing ?? null,
    })),
  };
}

export async function listProtocols(): Promise<Protocol[]> {
  const raw = await apiFetchJson<RawProtocol[]>('/api/protocols');
  return raw.map(toProtocol);
}

export async function createProtocol(input: CreateProtocolInput): Promise<Protocol> {
  const response = await apiFetch('/api/protocols', { method: 'POST', body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`Failed to create protocol (${response.status}).`);
  return toProtocol(await response.json());
}

/** PATCH /api/protocols/:id — used both for a full-form edit and for the
 * single-field `{ isActive: true }` / `{ visibility: ... }` actions, same
 * three call shapes the web app's protocols-manager.tsx uses against the
 * one PATCH endpoint. */
export async function updateProtocol(id: string, input: Partial<CreateProtocolInput> | { isActive: true } | { visibility: 'PRIVATE' | 'PUBLIC' }): Promise<Protocol> {
  const response = await apiFetch(`/api/protocols/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`Failed to update protocol (${response.status}).`);
  return toProtocol(await response.json());
}

export async function deleteProtocol(id: string): Promise<void> {
  const response = await apiFetch(`/api/protocols/${id}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete protocol (${response.status}).`);
  }
}

import { apiFetch, apiFetchJson } from '@/src/api/client';
import type { CreateSupplementInput } from '@/src/validation/schemas';

/** Raw wire shape — dosage is a Prisma Decimal (serializes as a string). */
interface RawSupplement {
  id: string;
  name: string;
  dosage: string;
  unit: string;
  frequency: string;
  timing: string | null;
  notes: string | null;
  active: boolean;
}

export interface Supplement {
  id: string;
  name: string;
  dosage: number;
  unit: string;
  frequency: string;
  timing: string | null;
  notes: string | null;
  active: boolean;
}

function toSupplement(raw: RawSupplement): Supplement {
  return { ...raw, dosage: Number(raw.dosage) };
}

export async function listSupplements(): Promise<Supplement[]> {
  const raw = await apiFetchJson<RawSupplement[]>('/api/supplements');
  return raw.map(toSupplement);
}

export async function createSupplement(input: CreateSupplementInput): Promise<Supplement> {
  const response = await apiFetch('/api/supplements', { method: 'POST', body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`Failed to create supplement (${response.status}).`);
  return toSupplement(await response.json());
}

export async function updateSupplement(
  id: string,
  input: Partial<CreateSupplementInput>,
): Promise<Supplement> {
  const response = await apiFetch(`/api/supplements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Failed to update supplement (${response.status}).`);
  return toSupplement(await response.json());
}

export async function deleteSupplement(id: string): Promise<void> {
  const response = await apiFetch(`/api/supplements/${id}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete supplement (${response.status}).`);
  }
}

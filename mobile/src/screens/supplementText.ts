import { enumLabel } from '@/src/validation/schemas';

interface SupplementLike {
  dosage: number | null;
  unit: string | null;
  frequency: string | null;
  timing: string | null;
}

/** "400mg · Daily · Evening" — leaves out whatever the supplement does not have. */
export function describeSupplement(s: SupplementLike): string {
  const dose = s.dosage != null ? `${s.dosage}${s.unit ?? ''}` : null;
  return [dose, s.frequency ? enumLabel(s.frequency) : null, s.timing ? enumLabel(s.timing) : null]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

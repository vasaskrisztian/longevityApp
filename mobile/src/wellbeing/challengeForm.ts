import type { CreateGroupChallengeInput, GroupChallengeMode, GroupChallengeType } from '@/src/api/groups';

/** Metrics whose results can be added up across people (sleep scores cannot). */
export const COLLECTIVE_TYPES: GroupChallengeType[] = ['DAILY_STEPS', 'WEEKLY_WORKOUTS'];

export const COLLECTIVE_FIELDS: Partial<Record<GroupChallengeType, { typeLabel: string; label: string; hint: string; default: string }>> = {
  DAILY_STEPS: {
    typeLabel: 'Steps',
    label: 'Team total of steps',
    hint: 'All steps of everyone who joins are added up between the first and the last day — there is no daily target, only the total counts.',
    default: '100000',
  },
  WEEKLY_WORKOUTS: {
    typeLabel: 'Workouts',
    label: 'Team total of workouts',
    hint: 'All workouts of everyone who joins are added up between the first and the last day — there is no weekly target, only the total counts.',
    default: '40',
  },
};

/** Personal-goal defaults per metric: [threshold, requiredCount]. */
export const INDIVIDUAL_DEFAULTS: Record<GroupChallengeType, [string, string]> = {
  DAILY_STEPS: ['8000', '10'],
  SLEEP_SCORE: ['80', '10'],
  WEEKLY_WORKOUTS: ['2', '4'],
};

/** The type chips of the create form: a team total is "Steps" / "Workouts", not "Daily steps" / "Weekly workouts" (there is no per-day or per-week target). */
export function typeOptionsFor(
  mode: GroupChallengeMode,
  options: { value: string; label: string }[],
): { value: string; label: string }[] {
  if (mode !== 'COLLECTIVE') return options;
  return options
    .filter((option) => COLLECTIVE_FIELDS[option.value as GroupChallengeType])
    .map((option) => ({ value: option.value, label: COLLECTIVE_FIELDS[option.value as GroupChallengeType]!.typeLabel }));
}

/** The type to use after switching the mode: a team total cannot be a sleep score. */
export function typeForMode(mode: GroupChallengeMode, type: GroupChallengeType): GroupChallengeType {
  return mode === 'COLLECTIVE' && !COLLECTIVE_TYPES.includes(type) ? 'DAILY_STEPS' : type;
}

export interface ChallengeFormValues {
  mode: GroupChallengeMode;
  type: GroupChallengeType;
  threshold: string;
  requiredCount: string;
  targetTotal: string;
}

const isPositiveInt = (value: number) => Number.isInteger(value) && value >= 1;

/** Field errors for the goal part of the form (the dates and name are checked by the screen). */
export function validateGoal(values: ChallengeFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const message = 'Enter a whole number, at least 1.';
  if (values.mode === 'COLLECTIVE') {
    if (!isPositiveInt(Number(values.targetTotal.replace(/\s/g, '')))) errors.targetTotal = message;
  } else {
    if (!isPositiveInt(Number(values.threshold))) errors.threshold = message;
    if (!isPositiveInt(Number(values.requiredCount))) errors.requiredCount = message;
  }
  return errors;
}

/** The goal fields of the request body — validated first with `validateGoal`. */
export function goalPayload(values: ChallengeFormValues): Pick<CreateGroupChallengeInput, 'mode' | 'threshold' | 'requiredCount' | 'targetTotal'> {
  if (values.mode === 'COLLECTIVE') {
    return { mode: 'COLLECTIVE', targetTotal: Number(values.targetTotal.replace(/\s/g, '')) };
  }
  return { mode: 'INDIVIDUAL', threshold: Number(values.threshold), requiredCount: Number(values.requiredCount) };
}

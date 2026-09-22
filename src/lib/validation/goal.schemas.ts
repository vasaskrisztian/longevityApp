import { z } from 'zod';

const GOAL_TYPE_VALUES = [
  'SLEEP_IMPROVEMENT',
  'STRESS_REDUCTION',
  'WEIGHT_LOSS',
  'WEIGHT_GAIN',
  'MUSCLE_GAIN',
  'RECOVERY',
  'CARDIOVASCULAR_FITNESS',
  'GENERAL_HEALTH',
  'ENERGY',
  'PERFORMANCE',
  'OTHER',
] as const;
const GOAL_STATUS_VALUES = ['ACTIVE', 'ACHIEVED', 'PAUSED', 'ABANDONED'] as const;

export const GoalTypeEnum = z.enum(GOAL_TYPE_VALUES);
export const GoalStatusEnum = z.enum(GOAL_STATUS_VALUES);

export const CreateGoalSchema = z.object({
  type: GoalTypeEnum,
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(1000).optional(),
  targetValue: z.coerce.number().max(1_000_000_000).optional(),
  targetUnit: z.string().trim().max(20).optional(),
  targetDate: z.coerce.date().optional(),
  status: GoalStatusEnum.default('ACTIVE'),
});

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

export const UpdateGoalSchema = CreateGoalSchema.partial();

export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;

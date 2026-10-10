import { z } from 'zod';
import { ChallengeTypeEnum } from './challenge.schemas';

/**
 * Corporate wellbeing (groups, invitations, group challenges).
 *
 * The logo travels as JSON (`{ contentType, dataBase64 }`) rather than
 * multipart so the Expo app (iOS, Android, web) and the Next.js UI can all
 * send it the same way. Its bytes are checked by `group-logo.ts`.
 */

export const GroupLogoInputSchema = z.object({
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  dataBase64: z.string().min(1).max(2_000_000),
});

export type GroupLogoInput = z.infer<typeof GroupLogoInputSchema>;

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(120),
  logo: GroupLogoInputSchema.optional(),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

export const UpdateGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(120).optional(),
  /** A new logo, or `null` to remove the current one; omitted = unchanged. */
  logo: GroupLogoInputSchema.nullable().optional(),
});

export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;

/** Accepts an array or one pasted string (commas / semicolons / spaces / newlines). */
function splitEmails(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export const InviteMembersSchema = z.object({
  emails: z.preprocess(
    splitEmails,
    z
      .array(z.string().trim().toLowerCase().email('Enter valid email addresses'))
      .min(1, 'Enter at least one email address')
      .max(50, 'At most 50 addresses at a time'),
  ),
});

export type InviteMembersInput = z.infer<typeof InviteMembersSchema>;

/** Calendar day `yyyy-mm-dd` (UTC) — group challenges run in whole days. */
const DayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format yyyy-mm-dd')
  .refine((value) => {
    // Round-trip: V8 happily rolls "2026-02-31" over into March.
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Not a valid date');

export const MAX_GROUP_CHALLENGE_DAYS = 366;

export const CreateGroupChallengeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(1000).optional(),
    type: ChallengeTypeEnum,
    // "above Y" — sleep score points / steps / workouts-per-week depending on `type`.
    threshold: z.coerce.number().int().min(1, 'Must be at least 1').max(100_000),
    // "X times" — nights / days / weeks depending on `type`.
    requiredCount: z.coerce.number().int().min(1, 'Must be at least 1').max(1000),
    /** First day of the challenge (inclusive). */
    startDate: DayString,
    /** Last day of the challenge (inclusive). */
    endDate: DayString,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'The end date cannot be before the start date',
    path: ['endDate'],
  })
  .refine(
    (data) => {
      const days = (Date.parse(`${data.endDate}T00:00:00Z`) - Date.parse(`${data.startDate}T00:00:00Z`)) / 86_400_000 + 1;
      return days <= MAX_GROUP_CHALLENGE_DAYS;
    },
    { message: `A challenge can last at most ${MAX_GROUP_CHALLENGE_DAYS} days`, path: ['endDate'] },
  );

export type CreateGroupChallengeInput = z.infer<typeof CreateGroupChallengeSchema>;

export const AcceptInvitationSchema = z.object({
  /** Explicit consent that the group's administrators may see the person's health data. */
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to share your health data with the group administrators' }),
  }),
});

export const MarkNotificationsReadSchema = z.object({
  ids: z.union([z.literal('all'), z.array(z.string().min(1)).min(1).max(200)]),
});

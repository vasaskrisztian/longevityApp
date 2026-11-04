import { z } from 'zod';
import { ChallengeTypeEnum } from './challenge.schemas';
import { parseYouTubeVideoId } from '@/lib/video/youtube';

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

export const GroupChallengeModeEnum = z.enum(['INDIVIDUAL', 'COLLECTIVE']);
export type GroupChallengeModeInput = z.infer<typeof GroupChallengeModeEnum>;

/**
 * Group challenges can also be about watching a video; personal challenges
 * (`ChallengeTypeEnum`) cannot, so the extra type lives only here.
 */
export const GroupChallengeTypeEnum = z.enum([...ChallengeTypeEnum.options, 'VIDEO_SESSIONS']);

/** The metrics whose results can be added up across people. Sleep scores cannot. */
export const COLLECTIVE_CHALLENGE_TYPES = ['DAILY_STEPS', 'WEEKLY_WORKOUTS', 'VIDEO_SESSIONS'] as const;
export const MIN_VIDEO_SECONDS = 10;
export const MAX_VIDEO_SECONDS = 4 * 60 * 60;
export const MAX_COLLECTIVE_TARGET = 100_000_000;

/**
 * `mode` INDIVIDUAL (default, the original shape): every participant has their
 * own goal — `threshold` ("above Y") and `requiredCount` ("X times").
 * `mode` COLLECTIVE: the participants' steps / workouts are summed and the team
 * shares one `targetTotal` ("100 000 steps together in a month"); `threshold`
 * and `requiredCount` do not apply and come out normalised as 0 / 1.
 * `type` VIDEO_SESSIONS: the challenge is about one YouTube video (`videoUrl`;
 * its length `videoDurationSec`, which "watched to the end" is measured
 * against, is read from YouTube unless the admin gives it). One finished viewing per person per day counts as one session;
 * INDIVIDUAL asks for `requiredCount` days, COLLECTIVE for `targetTotal`
 * sessions. `threshold` does not apply and comes out as 0.
 */
export const CreateGroupChallengeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(1000).optional(),
    mode: GroupChallengeModeEnum.default('INDIVIDUAL'),
    type: GroupChallengeTypeEnum,
    // "above Y" — sleep score points / steps / workouts-per-week depending on `type`.
    threshold: z.coerce.number().int().min(1, 'Must be at least 1').max(100_000).optional(),
    // "X times" — nights / days / weeks depending on `type`.
    requiredCount: z.coerce.number().int().min(1, 'Must be at least 1').max(1000).optional(),
    // COLLECTIVE only: the team's total (steps, or workouts) to reach.
    targetTotal: z.coerce.number().int().min(1, 'Must be at least 1').max(MAX_COLLECTIVE_TARGET).optional(),
    // VIDEO_SESSIONS only: a YouTube link, a title for the player, and the video's length in seconds.
    videoUrl: z.string().trim().max(500).optional(),
    videoTitle: z.string().trim().max(200).optional(),
    videoDurationSec: z.coerce
      .number()
      .int()
      .min(MIN_VIDEO_SECONDS, `The video must be at least ${MIN_VIDEO_SECONDS} seconds long`)
      .max(MAX_VIDEO_SECONDS, 'The video can be at most 4 hours long')
      .optional(),
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
  )
  .superRefine((data, ctx) => {
    if (data.type !== 'VIDEO_SESSIONS') return;
    if (!data.videoUrl) {
      ctx.addIssue({ code: 'custom', path: ['videoUrl'], message: 'Paste the YouTube link of the video' });
    } else if (!parseYouTubeVideoId(data.videoUrl)) {
      ctx.addIssue({ code: 'custom', path: ['videoUrl'], message: 'This is not a YouTube video link' });
    }
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'COLLECTIVE') {
      if (!(COLLECTIVE_CHALLENGE_TYPES as readonly string[]).includes(data.type)) {
        ctx.addIssue({ code: 'custom', path: ['type'], message: 'A team total can only be set for steps, workouts or a video' });
      }
      if (data.targetTotal === undefined) {
        ctx.addIssue({ code: 'custom', path: ['targetTotal'], message: 'Enter the team total to reach' });
      }
      return;
    }
    if (data.type === 'VIDEO_SESSIONS') {
      if (data.requiredCount === undefined) ctx.addIssue({ code: 'custom', path: ['requiredCount'], message: 'Required' });
      return;
    }
    if (data.threshold === undefined) ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'Required' });
    if (data.requiredCount === undefined) ctx.addIssue({ code: 'custom', path: ['requiredCount'], message: 'Required' });
  })
  .transform((data) => ({
    name: data.name,
    description: data.description,
    mode: data.mode,
    type: data.type,
    threshold: data.mode === 'COLLECTIVE' || data.type === 'VIDEO_SESSIONS' ? 0 : (data.threshold as number),
    requiredCount: data.mode === 'COLLECTIVE' ? 1 : (data.requiredCount as number),
    targetTotal: data.mode === 'COLLECTIVE' ? (data.targetTotal as number) : null,
    videoId: data.type === 'VIDEO_SESSIONS' ? (parseYouTubeVideoId(data.videoUrl as string) as string) : null,
    videoTitle: data.type === 'VIDEO_SESSIONS' ? data.videoTitle || data.name : null,
    // Left out = the server reads it from YouTube when the challenge is created.
    videoDurationSec: data.type === 'VIDEO_SESSIONS' ? (data.videoDurationSec ?? null) : null,
    startDate: data.startDate,
    endDate: data.endDate,
  }));

export type CreateGroupChallengeInput = z.infer<typeof CreateGroupChallengeSchema>;

/** Completing a started viewing: what the player says was really played. */
export const CompleteVideoWatchSchema = z.object({
  watchId: z.string().min(1).max(100),
  watchedSeconds: z.coerce.number().int().min(0).max(MAX_VIDEO_SECONDS * 2),
});

export const AcceptInvitationSchema = z.object({
  /** Explicit consent that the group's administrators may see the person's health data. */
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to share your health data with the group administrators' }),
  }),
});

export const MarkNotificationsReadSchema = z.object({
  ids: z.union([z.literal('all'), z.array(z.string().min(1)).min(1).max(200)]),
});

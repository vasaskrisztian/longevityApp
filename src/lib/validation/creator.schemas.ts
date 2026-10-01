import { z } from 'zod';

/** PATCH /api/admin/users/[id]/account-type body — admin-only, see
 * admin.service.ts's setUserAccountType. */
export const SetAccountTypeSchema = z.object({
  accountType: z.enum(['MEMBER', 'CREATOR']),
});

export type SetAccountTypeInput = z.infer<typeof SetAccountTypeSchema>;

/** PATCH /api/creators/me/consent body — the CREATOR's own explicit
 * opt-in/opt-out of having a public profile at all (separate from the
 * per-resource Protocol/Challenge visibility flags). */
export const SetPublicProfileConsentSchema = z.object({
  consent: z.boolean(),
});

export type SetPublicProfileConsentInput = z.infer<typeof SetPublicProfileConsentSchema>;

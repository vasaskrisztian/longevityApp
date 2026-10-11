import { PasswordSchema } from '@/src/validation/schemas';

/** First problem with a password-change form, or null. Mirrors the server rules so the form answers instantly. */
export function newPasswordProblem(current: string, next: string, confirmation: string): string | null {
  if (!current) return 'Enter your current password.';
  const parsed = PasswordSchema.safeParse(next);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'The new password is not valid.';
  if (next === current) return 'Choose a password different from the current one.';
  if (next !== confirmation) return 'The two new passwords do not match.';
  return null;
}

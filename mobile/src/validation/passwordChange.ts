import { t, tDynamic } from '@/src/i18n';
import { PasswordSchema } from '@/src/validation/schemas';

/** First problem with a password-change form (already in the current language), or null. Mirrors the server rules so the form answers instantly. */
export function newPasswordProblem(current: string, next: string, confirmation: string): string | null {
  if (!current) return t('passwordChange.currentRequired');
  const parsed = PasswordSchema.safeParse(next);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return message ? tDynamic(message) : t('passwordChange.newInvalid');
  }
  if (next === current) return t('passwordChange.sameAsCurrent');
  if (next !== confirmation) return t('passwordChange.mismatch');
  return null;
}

import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { ChangePasswordSchema } from '@/lib/validation/auth.schemas';
import { changePassword } from '@/modules/auth/account.service';

/** Change the signed-in user's own password (current password required). Signs out every mobile device. */
export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const rateLimit = checkRateLimit('password-change', userId, AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await changePassword(userId, parsed.data.currentPassword, parsed.data.newPassword);
  if (result === 'wrong_password') {
    return Response.json({ error: 'The current password is not correct.' }, { status: 400 });
  }
  if (result === 'unavailable') {
    return Response.json({ error: 'This account has no password to change.' }, { status: 409 });
  }
  return Response.json({ message: 'Password updated. Sign in again on your devices.' }, { status: 200 });
}

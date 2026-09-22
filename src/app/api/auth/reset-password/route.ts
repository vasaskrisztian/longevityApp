import { ResetPasswordSchema } from '@/lib/validation/auth.schemas';
import { resetPassword } from '@/modules/auth/auth.service';
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request);
  const rateLimit = checkRateLimit('password-reset-confirm', identifier, AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ok = await resetPassword(parsed.data.token, parsed.data.password);
  if (!ok) {
    return Response.json({ error: 'Invalid or expired reset link' }, { status: 400 });
  }

  return Response.json({ message: 'Password updated. You can now log in.' }, { status: 200 });
}

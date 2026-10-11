import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { DeleteAccountSchema } from '@/lib/validation/auth.schemas';
import { deleteAccount } from '@/modules/auth/account.service';

/** Permanently delete the signed-in user's own account and all of its data (password re-confirmed). */
export async function DELETE(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const rateLimit = checkRateLimit('account-delete', userId, AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = DeleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await deleteAccount(userId, parsed.data.password);
  switch (result) {
    case 'wrong_password':
      return Response.json({ error: 'The password is not correct.' }, { status: 400 });
    case 'admin_account':
      return Response.json(
        { error: 'Administrator accounts cannot be deleted here. Ask another administrator to change your role first.' },
        { status: 409 },
      );
    case 'unavailable':
      return Response.json({ error: 'This account cannot be deleted with a password.' }, { status: 409 });
    default:
      return new Response(null, { status: 204 });
  }
}

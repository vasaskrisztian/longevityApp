import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { UpdateLanguageSchema } from '@/lib/validation/auth.schemas';
import { getUserLanguage, setUserLanguage } from '@/modules/auth/account.service';

/** The signed-in user's preferred interface language. */
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  return Response.json({ language: await getUserLanguage(userId) });
}

/** Changes the preferred language (app texts, emails and notifications follow it). */
export async function PUT(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateLanguageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await setUserLanguage(userId, parsed.data.language);
  return Response.json({ language: parsed.data.language });
}

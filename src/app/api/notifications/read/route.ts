import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { MarkNotificationsReadSchema } from '@/lib/validation/group.schemas';
import { markNotificationsRead } from '@/modules/notifications/notifications.service';

/** Marks the given notifications (or `"all"`) read — only ever the caller's own. */
export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = MarkNotificationsReadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await markNotificationsRead(userId, parsed.data.ids);
  return Response.json({ updated }, { status: 200 });
}

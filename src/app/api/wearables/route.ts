import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { listConnectionsForUser } from '@/modules/wearable/services/wearable.service';

export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const connections = await listConnectionsForUser(userId);
  return Response.json(connections, { status: 200 });
}

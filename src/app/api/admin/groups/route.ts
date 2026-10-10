import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { CreateGroupSchema } from '@/lib/validation/group.schemas';
import { createGroup, listGroupsForAdmin } from '@/modules/groups/groups.service';
import { InvalidLogoError } from '@/modules/groups/group-logo';

/** Corporate wellbeing: the admin's list of groups (with member / pending-invitation counts). */
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    return toErrorResponse(error);
  }
  return Response.json({ groups: await listGroupsForAdmin() }, { status: 200 });
}

/** Creates a group from a name and an optional logo (`{ contentType, dataBase64 }`). */
export async function POST(request: Request) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return Response.json(await createGroup(adminId, parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof InvalidLogoError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

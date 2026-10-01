import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { SetAccountTypeSchema } from '@/lib/validation/creator.schemas';
import {
  userExistsForAdmin,
  setUserAccountType,
  recordAdminSetAccountType,
} from '@/modules/admin/admin.service';
import { logger } from '@/lib/logging/logger';

interface RouteParams {
  params: { id: string };
}

/**
 * Phase 13: the only way an account ever becomes (or stops being) a
 * CREATOR — see admin.service.ts's setUserAccountType doc comment for the
 * demotion cascade. Writes the ADMIN_SET_ACCOUNT_TYPE audit row, same
 * pattern as the existing ADMIN_VIEW_USER/ADMIN_TRIGGER_SYNC rows.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const exists = await userExistsForAdmin(params.id);
  if (!exists) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = SetAccountTypeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await setUserAccountType(params.id, parsed.data.accountType);
    await recordAdminSetAccountType(adminId, params.id, parsed.data.accountType);
    return Response.json({ accountType: parsed.data.accountType }, { status: 200 });
  } catch (error) {
    logger.error('admin_set_account_type_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update account type' }, { status: 500 });
  }
}

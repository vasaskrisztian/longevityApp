import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { CreateSupplementSchema } from '@/lib/validation/supplement.schemas';
import { listSupplements, createSupplement } from '@/modules/supplements/supplements.service';
import { logger } from '@/lib/logging/logger';

export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const supplements = await listSupplements(userId);
  return Response.json(supplements, { status: 200 });
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateSupplementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const supplement = await createSupplement(userId, parsed.data);
    return Response.json(supplement, { status: 201 });
  } catch (error) {
    logger.error('supplement_create_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to create supplement' }, { status: 500 });
  }
}

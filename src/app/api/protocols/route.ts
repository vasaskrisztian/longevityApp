import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { CreateProtocolSchema } from '@/lib/validation/protocol.schemas';
import { listProtocols, createProtocol } from '@/modules/protocols/protocols.service';
import { logger } from '@/lib/logging/logger';

export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const protocols = await listProtocols(userId);
  return Response.json(protocols, { status: 200 });
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateProtocolSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const protocol = await createProtocol(userId, parsed.data);
    return Response.json(protocol, { status: 201 });
  } catch (error) {
    logger.error('protocol_create_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to create protocol' }, { status: 500 });
  }
}

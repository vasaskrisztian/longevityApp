import { InvitationError } from '@/modules/groups/invitations.service';

/** Maps an invitation failure to its HTTP response; null for anything else (so the caller rethrows). */
export function invitationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof InvitationError)) return null;
  switch (error.reason) {
    case 'email_mismatch':
      return Response.json(
        { error: 'This invitation was sent to a different email address.', code: error.reason },
        { status: 403 },
      );
    case 'expired':
      return Response.json(
        { error: 'This invitation has expired. Ask the group administrator to send a new one.', code: error.reason },
        { status: 410 },
      );
    case 'revoked':
    case 'invalid':
      return Response.json({ error: 'This invitation is not valid.', code: error.reason }, { status: 404 });
    case 'accepted':
      return Response.json({ error: 'This invitation has already been accepted.', code: error.reason }, { status: 409 });
  }
}

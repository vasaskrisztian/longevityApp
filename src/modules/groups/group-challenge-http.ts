import { GroupChallengeError } from './group-challenges.service';

/** Maps a group-challenge failure to its HTTP response; null for anything else (so the caller rethrows). */
export function groupChallengeErrorResponse(error: unknown): Response | null {
  if (!(error instanceof GroupChallengeError)) return null;
  switch (error.code) {
    case 'not_member':
    case 'not_found':
      // One shape for both: a non-member must not learn which challenge ids exist.
      return Response.json({ error: 'Not found' }, { status: 404 });
    case 'watch_not_found':
      return Response.json({ error: error.message }, { status: 404 });
    case 'ended':
    case 'invalid_dates':
    case 'not_video':
    case 'not_active':
    case 'not_participant':
    case 'too_early':
    case 'not_watched':
    case 'expired':
      return Response.json({ error: error.message }, { status: 400 });
  }
}

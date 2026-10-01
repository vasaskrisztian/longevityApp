import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import {
  followCreator,
  unfollowCreator,
  isFollowing,
  CreatorNotFollowableError,
} from '@/modules/creators/creators.service';
import { logger } from '@/lib/logging/logger';

interface RouteParams {
  params: { id: string };
}

/** Following/unfollowing requires an account (the follower relationship is
 * scoped to the caller's own id — never taken from the request body), but
 * the target creator's existence/eligibility is re-checked inside
 * followCreator on every call, not just assumed from an earlier page load. */
export async function GET(_request: Request, { params }: RouteParams) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  const following = await isFollowing(userId, params.id);
  return Response.json({ following }, { status: 200 });
}

export async function POST(_request: Request, { params }: RouteParams) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  try {
    await followCreator(userId, params.id);
    return Response.json({ following: true }, { status: 200 });
  } catch (error) {
    if (error instanceof CreatorNotFollowableError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    logger.error('follow_creator_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to follow creator' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  try {
    await unfollowCreator(userId, params.id);
    return Response.json({ following: false }, { status: 200 });
  } catch (error) {
    logger.error('unfollow_creator_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to unfollow creator' }, { status: 500 });
  }
}

import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  requireAuthenticatedUser,
  requireAdmin,
  UnauthenticatedError,
  ForbiddenError,
  type SessionUser,
} from './authorization';

/**
 * Server Component variants of the authorization helpers: same checks as
 * requireAuthenticatedUser/requireAdmin, but redirect instead of throwing an
 * HTTP error (which is what Route Handlers do — see authorization.ts).
 * Middleware already redirects most of these cases first; this is the
 * defense-in-depth check that runs regardless of middleware.
 */

export async function requireAuthenticatedUserForPage(): Promise<SessionUser> {
  try {
    return await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect('/login');
    }
    throw error;
  }
}

export async function requireAdminForPage(): Promise<SessionUser> {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect('/login');
    }
    if (error instanceof ForbiddenError) {
      redirect('/dashboard');
    }
    throw error;
  }
}

/**
 * Gates dashboard/trends/profile (see their layout.tsx files) behind the
 * Phase 2 onboarding wizard: an authenticated user who hasn't completed it
 * yet is sent to /onboarding instead of seeing empty profile/exercise/
 * nutrition data. Admins are exempt — they don't go through the wizard —
 * so this never traps an admin-only account in a redirect loop.
 */
export async function requireOnboardedUserForPage(): Promise<SessionUser> {
  const user = await requireAuthenticatedUserForPage();
  if (user.role === UserRole.ADMIN) {
    return user;
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { onboardingCompletedAt: true },
  });
  if (!record?.onboardingCompletedAt) {
    redirect('/onboarding');
  }
  return user;
}

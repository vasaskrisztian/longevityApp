import type { Href } from 'expo-router';

import type { AppNotification } from '@/src/api/notifications';

/**
 * Where tapping a notification should take the person. One place decides it,
 * so a later navigation change only has to touch this file.
 *
 * Invitations land on the Community > Groups page with the invitation id (the page
 * scrolls to / highlights it); challenge notifications carry the group id
 * so the matching group opens first.
 */
export function notificationHref(notification: Pick<AppNotification, 'type' | 'data'>): Href {
  const data = notification.data ?? {};
  switch (notification.type) {
    case 'GROUP_INVITATION':
      return data.invitationId
        ? { pathname: '/community', params: { tab: 'groups', invitation: data.invitationId } }
        : '/community';
    case 'GROUP_CHALLENGE_NEW':
    case 'GROUP_CHALLENGE_SUMMARY':
    case 'GROUP_CHALLENGE_GOAL_REACHED':
      return data.groupId
        ? { pathname: '/community', params: { tab: 'groups', group: data.groupId, ...(data.challengeId ? { challenge: data.challengeId } : {}) } }
        : '/community';
    default:
      return '/community';
  }
}

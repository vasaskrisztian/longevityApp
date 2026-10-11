import { notificationHref } from '@/src/notifications/route';

describe('notificationHref', () => {
  it('opens the invitation from an invitation notification', () => {
    expect(notificationHref({ type: 'GROUP_INVITATION', data: { invitationId: 'i1', groupId: 'g1' } })).toEqual({
      pathname: '/community',
      params: { tab: 'groups', invitation: 'i1' },
    });
  });

  it('opens the group (and challenge when known) from a challenge notification', () => {
    expect(notificationHref({ type: 'GROUP_CHALLENGE_NEW', data: { groupId: 'g1', challengeId: 'c1' } })).toEqual({
      pathname: '/community',
      params: { tab: 'groups', group: 'g1', challenge: 'c1' },
    });
    expect(notificationHref({ type: 'GROUP_CHALLENGE_GOAL_REACHED', data: { groupId: 'g1' } })).toEqual({
      pathname: '/community',
      params: { tab: 'groups', group: 'g1' },
    });
  });

  it('falls back to the Groups page when the notification has no ids', () => {
    expect(notificationHref({ type: 'GROUP_INVITATION', data: null })).toBe('/community');
    expect(notificationHref({ type: 'GROUP_CHALLENGE_SUMMARY', data: {} })).toBe('/community');
  });
});

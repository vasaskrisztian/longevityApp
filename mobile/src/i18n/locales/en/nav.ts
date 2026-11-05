/** Navigation chrome: tabs, screen titles, hubs, notifications inbox and shared UI built-ins. */
export const nav = {
  'nav.tab.today': 'Today',
  'nav.tab.plan': 'Plan',
  'nav.tab.community': 'Community',
  'nav.tab.me': 'Me',
  'nav.tab.notifications': 'Notifications',
  'nav.tab.admin': 'Admin',

  'nav.segment.today': 'Today',
  'nav.segment.trends': 'Trends',
  'nav.segment.body': 'Body',
  'nav.segment.personal': 'Personal',
  'nav.segment.exercise': 'Exercise',
  'nav.segment.nutrition': 'Nutrition',
  'nav.segment.groups': 'Groups',
  'nav.segment.creators': 'Creators',
  'nav.segment.users': 'Users',

  'nav.me.about': 'About me',
  'nav.me.aboutDescription': 'Personal details, exercise, nutrition',
  'nav.me.devices': 'Devices',
  'nav.me.devicesAndData': 'Devices and data',
  'nav.me.devicesDescription': 'Oura, Apple Health and syncing',
  'nav.me.account': 'Account',
  'nav.me.accountDescription': 'Sign-in, public profile',

  'nav.plan.intro': 'What you follow and what you aim for.',
  'nav.plan.protocols': 'Protocols and goals',
  'nav.plan.protocolsDescription': 'The routine you follow, its daily targets and the goals behind it',
  'nav.plan.supplements': 'Supplements',
  'nav.plan.supplementsDescription': 'Everything you take; protocols pick from this list',
  'nav.plan.goals': 'Goals',
  'nav.plan.challenges': 'My challenges',
  'nav.plan.challengesDescription': 'Challenges you set for yourself',
  'nav.plan.following': 'Currently following',
  'nav.plan.noActiveProtocol': 'No active protocol yet. Open Protocols to pick or create one.',

  'nav.community.creators': 'Creators',
  'nav.community.creator': 'Creator',

  'nav.admin.person': 'Person',
  'nav.admin.group': 'Group',
  'nav.admin.challenge': 'Challenge',

  'nav.notFound.title': 'Not found',
  'nav.notFound.heading': 'This page doesn\'t exist',
  'nav.notFound.body': 'The link may be old or mistyped. Your data is safe — head back to the start.',
  'nav.notFound.goHome': 'Go to Dashboard',

  'nav.public.createAccount': 'Create a free account',
  'nav.public.haveAccount': 'I already have an account',

  'nav.badge.unread': '{count} unread',
  'nav.badge.pendingInvitations_one': '{count} pending invitation',
  'nav.badge.pendingInvitations_other': '{count} pending invitations',

  'notif.title': 'Notifications',
  'notif.bellUnread': 'Notifications, {count} unread',
  'notif.markAllRead': 'Mark all as read',
  'notif.loadFailed': 'Could not load your notifications.',
  'notif.markFailed': 'Could not mark the notifications as read.',
  'notif.empty': 'Nothing here yet. Group invitations, new group challenges and challenge results will show up in this list.',
  'notif.unread': 'Unread',

  'ui.info.whatIsThis': '{title}: what is this?',
  'ui.info.close': 'Close explanation',
  'ui.error.requestFailed': 'Request failed ({status}).',
} as const;

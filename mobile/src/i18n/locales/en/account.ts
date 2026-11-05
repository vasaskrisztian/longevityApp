/** Me > Account. */
export const account = {
  'account.signedInAs': 'Signed in as',

  'account.creator.title': 'Creator public profile',
  'account.creator.publicDescription':
    'Your public protocols, challenges, and recent data are visible to anyone in the Creators directory.',
  'account.creator.privateDescription':
    'Turn this on to let followers see your public protocols, challenges, and recent data in the Creators directory.',
  'account.creator.updating': 'Updating…',
  'account.creator.makePrivate': 'Make profile private',
  'account.creator.publish': 'Publish profile publicly',

  'account.language.saveFailed': 'Could not save the language. Please try again.',

  'account.password.title': 'Change password',
  'account.password.description':
    'After the change you are signed out on all your devices and sign in again with the new password.',
  'account.password.success': 'Password updated. Signing you out…',
  'account.password.current': 'Current password',
  'account.password.new': 'New password',
  'account.password.repeat': 'Repeat new password',
  'account.password.submit': 'Change password',
  'account.password.failed': 'Could not change the password. Please try again.',

  'account.sharing.title': 'Who can see my data',
  'account.sharing.loadFailed': 'Could not load your groups.',
  'account.sharing.none': 'No group can see your health data. It is visible only to you.',
  'account.sharing.description':
    'Administrators of these groups can see your health data. You can stop sharing at any time by leaving a group.',
  'account.sharing.leaveTitle': 'Leave {name}?',
  'account.sharing.leaveMessage':
    'The group’s administrators will no longer be able to see your health data, and you will be removed from its challenges.',
  'account.sharing.leaveConfirm': 'Leave group',
  'account.sharing.leaveFailed': 'Could not leave the group. Please try again.',

  'account.data.title': 'Your data',
  'account.data.description':
    'The app stores your profile and goals, wearable and Apple Health readings, InBody measurements, protocols, supplements and challenge progress. Your data is visible only to you, plus the administrators of groups you have joined and the followers of a public creator profile you have published yourself.',
  'account.data.deleteNote': 'Deleting your account (below) permanently removes all of it.',

  'account.delete.title': 'Delete account',
  'account.delete.description':
    'Permanently deletes your account and all of your data, and disconnects your wearable. This cannot be undone.',
  'account.delete.passwordLabel': 'Your password',
  'account.delete.enterPassword': 'Enter your password to confirm.',
  'account.delete.confirmTitle': 'Delete your account?',
  'account.delete.confirmMessage': 'Your account and all of your data will be permanently deleted. This cannot be undone.',
  'account.delete.confirmButton': 'Delete account',
  'account.delete.failed': 'Could not delete the account. Please try again.',
  'account.delete.submit': 'Delete my account',
  'account.delete.open': 'Delete account…',
} as const;

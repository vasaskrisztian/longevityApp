import type { Href } from 'expo-router';

/**
 * Old (pre-redesign) paths → their new home, so bookmarks, emails and
 * notifications that still point at /profile/*, /devices or /trends keep working.
 * `rest` is the path below /profile (e.g. ['goals'] for /profile/goals).
 */
export function legacyProfileHref(rest: string[]): Href {
  const [first, second] = rest;
  switch (first) {
    case undefined:
      return '/me';
    case 'goals':
    case 'supplements':
    case 'protocols':
    case 'challenges':
      return `/plan/${first}` as Href;
    case 'discover':
      return '/community?tab=creators';
    case 'wellbeing':
      return '/community';
    case 'creators':
      return second ? (`/community/creators/${second}` as Href) : '/community/browse';
    case 'nutrition':
      return '/me/about?tab=nutrition';
    case 'lifestyle':
      return '/me/about?tab=exercise';
    case 'inbody':
      return '/?tab=body';
    default:
      return '/me';
  }
}

import {
  LayoutDashboard,
  TrendingUp,
  User,
  Leaf,
  Utensils,
  Pill,
  Scale,
  Target,
  Watch,
  ShieldCheck,
  ClipboardList,
  Trophy,
  Compass,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  // One glance-recognizable icon per item, rendered in the sidebar next to
  // the label — purely a navigation-speed aid, chosen per item's subject
  // (a scale for body-composition tracking, a pill for supplements, etc.),
  // not decorative filler.
  icon: LucideIcon;
  adminOnly?: boolean;
  // Hides the item from the sidebar without removing its route, page, or
  // data — flip back to false/omit to bring it back. Currently used for
  // Goals and Nutrition, which are built but not ready to be user-facing
  // yet (product decision, not a code removal).
  hidden?: boolean;
}

// Per ARCHITECTURE.md / spec §38, plus Nutrition (its own onboarding
// section and route) alongside Lifestyle.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Trends', href: '/trends', icon: TrendingUp },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Lifestyle', href: '/profile/lifestyle', icon: Leaf },
  { label: 'Nutrition', href: '/profile/nutrition', icon: Utensils, hidden: true },
  { label: 'Supplements', href: '/profile/supplements', icon: Pill },
  { label: 'Protocols', href: '/profile/protocols', icon: ClipboardList },
  { label: 'Challenges', href: '/profile/challenges', icon: Trophy },
  { label: 'Discover', href: '/profile/discover', icon: Compass },
  { label: 'InBody', href: '/profile/inbody', icon: Scale },
  { label: 'Goals', href: '/profile/goals', icon: Target, hidden: true },
  { label: 'Devices', href: '/profile/devices', icon: Watch },
  { label: 'Admin', href: '/admin', icon: ShieldCheck, adminOnly: true },
];

/**
 * The one nav item that should look selected for `pathname`: the item with
 * the longest href that equals the path or is a path prefix of it. Plain
 * prefix matching highlighted "Profile" (/profile) together with every
 * sub-page entry (Devices at /profile/devices, Lifestyle, Protocols...),
 * because those live under /profile too — the most specific match wins, so
 * /profile/devices selects only Devices, and /profile/anything-unlisted
 * (e.g. /profile/creators) still falls back to Profile.
 */
export function findActiveNavHref(pathname: string, items: readonly Pick<NavItem, 'href'>[]): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

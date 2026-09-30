export interface NavItem {
  label: string;
  href: string;
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
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Trends', href: '/trends' },
  { label: 'Profile', href: '/profile' },
  { label: 'Lifestyle', href: '/profile/lifestyle' },
  { label: 'Nutrition', href: '/profile/nutrition', hidden: true },
  { label: 'Supplements', href: '/profile/supplements' },
  { label: 'Goals', href: '/profile/goals', hidden: true },
  { label: 'Devices', href: '/profile/devices' },
  { label: 'Admin', href: '/admin', adminOnly: true },
];

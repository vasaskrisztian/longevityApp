export interface NavItem {
  label: string;
  href: string;
  adminOnly?: boolean;
}

// Per ARCHITECTURE.md / spec §38, plus Nutrition (its own onboarding
// section and route) alongside Lifestyle.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Trends', href: '/trends' },
  { label: 'Profile', href: '/profile' },
  { label: 'Lifestyle', href: '/profile/lifestyle' },
  { label: 'Nutrition', href: '/profile/nutrition' },
  { label: 'Supplements', href: '/profile/supplements' },
  { label: 'Goals', href: '/profile/goals' },
  { label: 'Devices', href: '/profile/devices' },
  { label: 'Admin', href: '/admin', adminOnly: true },
];

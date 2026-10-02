/**
 * Design tokens ported from the web app's tailwind.config.ts
 * (apps root: tailwind.config.ts, "Design tokens per ARCHITECTURE.md §37").
 * Keep these two files in sync by hand until a shared package exists
 * (see claude/phase-15-mobile-migration-plan.md).
 */
export const colors = {
  background: '#FAF9F4',
  foreground: '#12181B',
  card: {
    default: '#FFFFFF',
    border: '#E7E9EC',
  },
  primary: {
    default: '#2F4A38',
    dark: '#1B2E22',
    foreground: '#FFFFFF',
  },
  accent: {
    default: '#8F6224',
    light: '#C9A15D',
    foreground: '#FFFFFF',
  },
  muted: {
    default: '#F1EDE3',
    foreground: '#6B6459',
  },
  success: '#1F8A5F',
  warning: '#B7791F',
  danger: '#B3261E',
} as const;

export const radii = {
  xl: 16,
  '2xl': 20,
} as const;

export const shadows = {
  subtle: {
    shadowColor: '#10181B',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  glow: {
    shadowColor: '#2F4A38',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

// Fraunces (display/serif) + Inter (sans) — same families as
// @fontsource/fraunces and @fontsource/inter on the web app.
export const fontFamily = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  display: 'Fraunces_600SemiBold',
} as const;

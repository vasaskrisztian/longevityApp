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

/**
 * Brand gradients: forest green running into a deeper forest (the "selected"
 * look of the old web sidebar), and the soft white-to-cream wash behind the
 * sidebar. Rendered with `BrandGradient` (react-native-svg, so no extra
 * native module and the same result on iOS, Android and web).
 */
export const gradients = {
  active: [colors.primary.default, colors.primary.dark],
  sidebar: ['#FFFFFF', colors.muted.default],
} as const;

/** Soft tints of the two brand colors for hover/active washes. */
export const tints = {
  gold: 'rgba(143, 98, 36, 0.10)',
  goldStrong: 'rgba(143, 98, 36, 0.16)',
  green: 'rgba(47, 74, 56, 0.08)',
} as const;

/** Soft gold glow for small gold accents (mirrors the web `shadow-glow-gold`). */
export const goldGlow = {
  shadowColor: '#8F6224',
  shadowOpacity: 0.4,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
} as const;

/**
 * Background of a full-screen route inside the tab area: transparent, so the
 * decorative backdrop (AppBackdrop) shows through. On the web it is drawn once
 * behind the whole content area ((tabs)/_layout.tsx, DesktopShell); on
 * iOS/Android the navigator's own scene colour (the brand background) sits
 * behind the screens and the tab roots draw the backdrop themselves
 * (ScreenBackdrop), which keeps native-stack transitions opaque.
 */
export const screenBackground = 'transparent';

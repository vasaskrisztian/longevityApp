import type { Config } from 'tailwindcss';

// Design tokens per ARCHITECTURE.md §37 — premium, minimal, calm health-tech.
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FAF9F4',
        foreground: '#12181B',
        card: {
          DEFAULT: '#FFFFFF',
          border: '#E7E9EC',
        },
        // Brand palette sampled from the @longevity.klub Instagram profile
        // (logo + post imagery) — forest green as primary, warm gold/bronze
        // as accent. Background stays light per product requirement.
        // `primary.dark` / `accent.light` are derived shades (not sampled
        // separately) used for gradients and glow effects in the more
        // expressive brand treatment — swap all four alongside each other
        // if the sampled brand colors are ever corrected from real assets.
        primary: {
          DEFAULT: '#2F4A38', // brand forest green (from the Instagram logo)
          dark: '#1B2E22', // deeper forest, for gradients/active states
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#8F6224', // brand warm gold/bronze (from Instagram posts); ~5.3:1 contrast on white
          light: '#C9A15D', // lighter gold, for gradients/glow highlights
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F1EDE3',
          foreground: '#6B6459',
        },
        success: '#1F8A5F',
        warning: '#B7791F',
        danger: '#B3261E',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(16, 24, 27, 0.04), 0 1px 6px rgba(16, 24, 27, 0.04)',
        // Soft brand-colored glows for the more expressive treatment —
        // used behind the active nav pill and the sidebar brand mark.
        glow: '0 8px 24px -6px rgba(47, 74, 56, 0.45)',
        'glow-gold': '0 6px 18px -4px rgba(143, 98, 36, 0.4)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Display/heading face — a warmer, more editorial serif than the
        // UI's sans body text, for the "extravagant" brand pass (page
        // titles, card titles, the sidebar wordmark). Loaded via next/font
        // in layout.tsx.
        display: ['var(--font-display)', 'Georgia', 'ui-serif', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;

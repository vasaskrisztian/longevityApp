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
        primary: {
          DEFAULT: '#2F4A38', // brand forest green (from the Instagram logo)
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#8F6224', // brand warm gold/bronze (from Instagram posts); ~5.3:1 contrast on white
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
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

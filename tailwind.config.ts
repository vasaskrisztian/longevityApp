import type { Config } from 'tailwindcss';

// Design tokens per ARCHITECTURE.md §37 — premium, minimal, calm health-tech.
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F7F8FA',
        foreground: '#12181B',
        card: {
          DEFAULT: '#FFFFFF',
          border: '#E7E9EC',
        },
        primary: {
          DEFAULT: '#0F4C42', // sophisticated dark green / teal
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F1F3F4',
          foreground: '#5B6670',
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

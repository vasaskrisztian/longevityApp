import type { Metadata } from 'next';
// Self-hosted via @fontsource (plain npm packages, not next/font/google):
// next/font/google needs a *live* fetch to fonts.googleapis.com/gstatic.com
// at build time to pull down the font files, which this project's build
// environments cannot always reach (the same class of network restriction
// documented elsewhere in this repo for binaries.prisma.sh) -- it's not
// guaranteed to succeed everywhere `next build` runs. @fontsource ships the
// actual .woff2 files as static package assets fetched once over npm's
// registry at `npm install` time, so there is no build-time font fetch at
// all, ever. Weights are the ones actually used: Inter 400/500/600 for body
// UI text, Fraunces 500/600/700 for the display/heading face.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Longevity App',
  description: 'Your sleep, recovery and activity, in one calm dashboard.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import Link from 'next/link';

/**
 * Phase 13: the one corner of this app rendered for a logged-out visitor —
 * see middleware.ts's `protectedPrefixes`, which deliberately does not list
 * `/creators`. No Sidebar/app-shell here (that assumes an authenticated
 * session); just a minimal header with a way back into the app.
 */
export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-card-border px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/creators" className="text-sm font-semibold tracking-tight text-primary">
            Longevity Klub · Creators
          </Link>
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary">
            Log in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}

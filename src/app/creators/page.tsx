import Link from 'next/link';
import { listPublicCreators } from '@/modules/creators/creators.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const metadata = { title: 'Creators — Longevity Klub' };

// No auth/cookies call and no dynamic segment here, so Next.js would
// otherwise try to statically prerender this page at build time — which
// fails the Railway build (no live Postgres in the build step) and would
// also serve a stale follower/publish snapshot to every visitor in
// production. Follower counts and publish state must always be current.
export const dynamic = 'force-dynamic';

export default async function CreatorsDirectoryPage() {
  const creators = await listPublicCreators();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">Creators</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow a creator to see their published protocols, challenges and results.
        </p>
      </div>

      {creators.length === 0 ? (
        <p className="text-sm text-muted-foreground">No public creators yet — check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {creators.map((creator) => (
            <Link key={creator.id} href={`/creators/${creator.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>{creator.fullName ?? 'Creator'}</CardTitle>
                  <CardDescription>
                    {creator.followerCount} follower{creator.followerCount === 1 ? '' : 's'} · since{' '}
                    {creator.memberSince.toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {creator.publicProtocolCount} public protocol{creator.publicProtocolCount === 1 ? '' : 's'} ·{' '}
                  {creator.publicChallengeCount} public challenge{creator.publicChallengeCount === 1 ? '' : 's'}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

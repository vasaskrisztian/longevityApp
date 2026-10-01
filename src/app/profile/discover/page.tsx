import Link from 'next/link';
import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { listMyFollowing } from '@/modules/creators/creators.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { UnfollowButton } from './unfollow-button';

export default async function DiscoverPage() {
  const user = await requireAuthenticatedUserForPage();
  const following = await listMyFollowing(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="relative inline-block font-display text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-2/3 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent">
          Discover
        </h1>
        <Link href="/creators" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Browse all creators
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Creators you follow</CardTitle>
          <CardDescription>
            Their public protocols, challenges and results — followers stay anonymous to each other and to
            the creator; only your own follow list is ever shown to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {following.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You&apos;re not following anyone yet. <Link href="/creators" className="text-primary underline">Browse creators</Link>.
            </p>
          ) : (
            following.map((creator) => (
              <div
                key={creator.id}
                className="flex items-center justify-between rounded-xl border border-card-border p-4"
              >
                <div>
                  <Link href={`/creators/${creator.id}`} className="font-medium text-primary hover:underline">
                    {creator.fullName ?? 'Creator'}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Following since {creator.followedAt.toLocaleDateString()} ·{' '}
                    {creator.publicProtocolCount} protocol{creator.publicProtocolCount === 1 ? '' : 's'} ·{' '}
                    {creator.publicChallengeCount} challenge{creator.publicChallengeCount === 1 ? '' : 's'}
                  </p>
                </div>
                <UnfollowButton creatorId={creator.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

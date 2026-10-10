import { InviteView } from '@/components/wellbeing/invite-view';

// The token only ever lives in the URL; it is sent to the API from the browser,
// never rendered into the HTML.
export const dynamic = 'force-dynamic';

export default function InvitePage({ params }: { params: { token: string } }) {
  return <InviteView token={params.token} />;
}

import { verifyEmail } from '@/modules/auth/auth.service';
import { resolveWebAppUrl } from '@/lib/http/app-url';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.json({ error: 'Missing token' }, { status: 400 });
  }

  const ok = await verifyEmail(token);
  if (!ok) {
    return Response.json({ error: 'Invalid or expired verification link' }, { status: 400 });
  }

  return Response.redirect(resolveWebAppUrl('/login?verified=1', request.url));
}

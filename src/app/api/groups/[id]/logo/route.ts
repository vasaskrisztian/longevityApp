import { getGroupLogo } from '@/modules/groups/groups.service';

/**
 * Public on purpose: the logo is embedded in invitation emails and shown on
 * the signed-out invitation page. It exposes only the image the admin chose
 * for that group id (a random UUID) — never anything about its members.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const logo = await getGroupLogo(params.id);
  if (!logo) return Response.json({ error: 'Not found' }, { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    status: 200,
    headers: {
      'Content-Type': logo.contentType,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      // Raster images only, but belt and braces: never let it run as a document.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}

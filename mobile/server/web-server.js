/* eslint-disable @typescript-eslint/no-require-imports */
// Production static server for the Expo web export (`expo export --platform web`).
// Zero dependencies on purpose: the runtime image only needs Node + `dist/`.
//
// Expo Router's static export writes one HTML file per route
// (`profile/goals.html`, `creators/[id].html`, ...). This resolves clean URLs
// to those files, matches dynamic `[param]` segments at any depth, serves
// `+not-found.html` with a real 404 for unknown paths, and exposes /healthz
// for Railway. No /api proxying: the app talks to the backend directly
// (src/config/env.ts) and the backend allow-lists this origin via CORS.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const PORT = Number(process.env.PORT || process.argv[3] || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function listDir(p) {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

/** Resolve route segments below `dir` to an .html file, preferring literal matches over [param] ones. */
function matchRoute(dir, segments) {
  if (segments.length === 0) {
    const index = path.join(dir, 'index.html');
    return isFile(index) ? index : null;
  }
  const [head, ...rest] = segments;
  const entries = listDir(dir);
  const candidates = [head, ...entries.filter((e) => /^\[[^\]]+\](\.html)?$/.test(e) && !e.startsWith('[...'))];
  for (const cand of candidates) {
    const name = cand.replace(/\.html$/, '');
    if (rest.length === 0) {
      const file = path.join(dir, `${name}.html`);
      if (isFile(file)) return file;
    }
    const sub = path.join(dir, name);
    if (listDir(sub).length) {
      const hit = matchRoute(sub, rest);
      if (hit) return hit;
    }
  }
  return null;
}

function resolveRequest(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { file: null, status: 400 };
  }
  if (decoded.includes('\0')) return { file: null, status: 400 };
  const rel = path.posix.normalize(decoded).replace(/^\/+/, '').replace(/\/+$/, '');
  if (rel.startsWith('..')) return { file: null, status: 400 };

  // 1. A real static asset (has an extension) — serve as-is, never fall back to a page.
  if (path.extname(rel)) {
    const file = path.join(ROOT, rel);
    if (file.startsWith(ROOT + path.sep) && isFile(file)) return { file, status: 200 };
    return { file: null, status: 404 };
  }
  // 2. A page route.
  const segments = rel === '' ? [] : rel.split('/');
  const page = matchRoute(ROOT, segments);
  if (page) return { file: page, status: 200 };
  // 3. Unknown: Expo's +not-found page, with a real 404.
  const nf = path.join(ROOT, '+not-found.html');
  return { file: isFile(nf) ? nf : null, status: 404 };
}

function cacheControl(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (rel.startsWith('_expo/static/') || rel.startsWith('assets/')) return 'public, max-age=31536000, immutable';
  if (file.endsWith('.html')) return 'no-cache';
  return 'public, max-age=3600';
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('ok');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', ...SECURITY_HEADERS });
    res.end();
    return;
  }
  const { file, status } = resolveRequest(url.pathname);
  if (!file) {
    res.writeHead(status, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end(status === 400 ? 'Bad request' : 'Not found');
    return;
  }
  res.writeHead(status, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': status === 200 ? cacheControl(file) : 'no-store',
    ...SECURITY_HEADERS,
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Expo web export (${ROOT}) listening on :${PORT}`);
});

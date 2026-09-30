/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // tesseract.js spawns a worker_thread from a real file path
    // (worker-script/node/index.js) relative to its own package directory,
    // and sharp loads a platform-specific native .node binary the same way.
    // Left in Next's webpack bundle, both paths get rewritten to point
    // inside .next/ (where neither file actually exists), which is exactly
    // what production logs showed: "Cannot find module
    // '/app/.next/worker-script/node/index.js'" every time the InBody
    // upload route touched tesseract.js -- API-route requests were racing
    // between the worker's error being silently swallowed by Node's
    // worker_thread bootstrap (looking like the upload hanging forever, as
    // first reported) and it surfacing as an immediate generic failure
    // (as reported the second time). This tells Next.js to require() these
    // two packages from node_modules at their real on-disk path instead of
    // bundling them, which is the documented fix for exactly this failure
    // mode with native-binary/worker-thread packages in Next.js API routes.
    serverComponentsExternalPackages: ['tesseract.js', 'sharp'],
  },
  // Health data should never leak into client-visible source maps in production.
  productionBrowserSourceMaps: false,
};

export default nextConfig;

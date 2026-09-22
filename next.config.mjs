/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Health data should never leak into client-visible source maps in production.
  productionBrowserSourceMaps: false,
};

export default nextConfig;

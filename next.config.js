/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: '/service/:path*' },
    ];
  },
};
module.exports = nextConfig;

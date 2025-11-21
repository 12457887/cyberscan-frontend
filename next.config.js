/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: '/dashboard/support',
        destination: '/dashboard?section=support',
      },
      {
        source: '/api/:path*',
        destination: '/service/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

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
    ];
  },
};

module.exports = nextConfig;

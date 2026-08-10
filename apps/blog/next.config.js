//@ts-check

const { composePlugins, withNx } = require('@nx/next');
const { join } = require('path');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  reactStrictMode: true,

  // The Nest app is imported from `apps/api/src`, which lives outside this
  // project's directory; tracing has to start at the workspace root so the
  // serverless bundle picks it up.
  outputFileTracingRoot: join(__dirname, '../../'),

  images: {
    // Images are served from Vercel Blob once uploaded through the admin.
    remotePatterns: [{ protocol: 'https', hostname: '**.public.blob.vercel-storage.com' }],
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

const plugins = [withNx];

module.exports = composePlugins(...plugins)(nextConfig);

//@ts-check

const { join } = require('path');

/**
 * A plain Next.js config, deliberately free of `@nx/next`'s `withNx` wrapper.
 *
 * `withNx` only earns its place when you use Nx's SVGR handling, file
 * replacements or its own output paths — none of which this app does. Keeping
 * it meant `next.config.js` required a devDependency at build time, which is
 * exactly the kind of coupling that breaks a deployment where devDependencies
 * are pruned. Nx still infers its targets from the presence of this file.
 *
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  reactStrictMode: true,

  typescript: {
    // Type checking is CI's job, not the deploy's — `npm run typecheck` runs
    // both projects on every push and pull request. Doing it again here would
    // drag every dev-only @types package (express, pako, turndown, jest) into
    // the production dependency graph purely to satisfy a duplicate check.
    ignoreBuildErrors: true,
  },

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

module.exports = nextConfig;

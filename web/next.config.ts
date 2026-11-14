import type { NextConfig } from 'next';

const config: NextConfig = {
  // contracts/ai ship TypeScript source from the workspace; Next compiles them.
  transpilePackages: ['@lastmile/contracts', '@lastmile/ai'],
  // `pnpm lint` runs separately in scripts/verify.sh; don't run it twice during build.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  // `pnpm demo` builds into its own folder so `pnpm verify` (which rebuilds .next) can't break a running demo server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default config;

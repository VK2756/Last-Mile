import type { NextConfig } from 'next';

const config: NextConfig = {
  // contracts/ai ship TypeScript source from the workspace; Next compiles them.
  transpilePackages: ['@lastmile/contracts', '@lastmile/ai'],
  // `pnpm lint` runs separately in scripts/verify.sh; don't run it twice during build.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
};

export default config;

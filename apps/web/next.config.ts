import { withSerwist } from '@serwist/turbopack';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@dots/game-engine', '@dots/cpu-engine', '@dots/protocol'],
};

export default withSerwist(nextConfig);

import type { NextConfig } from "next";

const configuredDistDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  // Playwright gets an isolated build directory so it can run beside a local
  // development server without sharing Next.js locks or generated artifacts.
  // An empty optional env value must be omitted: Next rejects `distDir: ""`.
  ...(configuredDistDir ? { distDir: configuredDistDir } : {}),
};

export default nextConfig;

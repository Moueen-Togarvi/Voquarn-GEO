import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright gets an isolated build directory so it can run beside a local
  // development server without sharing Next.js locks or generated artifacts.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;

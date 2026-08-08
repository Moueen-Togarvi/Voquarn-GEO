import type { NextConfig } from "next";

const configuredDistDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  // Playwright gets an isolated build directory so it can run beside a local
  // development server without sharing Next.js locks or generated artifacts.
  // An empty optional env value must be omitted: Next rejects `distDir: ""`.
  ...(configuredDistDir ? { distDir: configuredDistDir } : {}),
  // playwright.config.ts's baseURL is http://127.0.0.1:<port> — without this,
  // Next's dev server treats that as a foreign origin and blocks its dev
  // client bootstrap, so pages never hydrate and every e2e interaction after
  // the first click silently falls back to a native (non-JS) form submit.
  // Ignored outside next dev, so this is safe to always include.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;

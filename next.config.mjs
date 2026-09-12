/**
 * Dev and production builds write to different directories on purpose.
 *
 * Running `next build` against a live dev server's `.next` corrupts its
 * chunks, and the running app starts throwing MODULE_NOT_FOUND mid-demo.
 * `scripts/next-prod.mjs` sets NEXT_DIST_DIR for build and start, so the two
 * can never collide and there is no env var for anyone to remember.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Set by scripts/next-prod.mjs for build/start; dev keeps the default.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // The floating dev badge overlaps the REPEAT dock during a live demo.
  devIndicators: false,
  // Cloudflare Workers cannot run sharp, so the deployed build serves images
  // as they are. The only image is the logo, which is already the size it is
  // drawn at, so there is nothing for an optimizer to do.
  images: { unoptimized: true },
  env: {
    // Demo Mode is ON unless explicitly disabled. A hackathon demo must never
    // depend on the network. See lib/demo/config.ts for the resolution order.
    NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE ?? process.env.NEXT_PUBLIC_DEMO_MODE ?? 'true',
    // area=channel pairs, so the planner can name the right desk in the browser.
    NEXT_PUBLIC_SLACK_AREA_CHANNELS: process.env.SLACK_AREA_CHANNELS ?? '',
  },
};

export default nextConfig;

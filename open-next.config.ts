/**
 * Cloudflare Workers build for REPEAT.
 *
 * The deployed site is the Demo Mode build: deterministic, offline, no keys.
 * No cache binding is configured because nothing is revalidated — every page
 * is either static or rendered per request from in-memory demo data.
 *
 * OpenNext reads the Next.js output from `.next` and nowhere else, so this
 * build cannot use the `.next-build` directory that `npm run build` keeps
 * separate for a running dev server (see next.config.mjs). Stop `npm run dev`
 * before building for Cloudflare, or build from a clean checkout.
 */
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default {
  ...defineCloudflareConfig(),
  // Not `npm run build`: that one redirects the output to `.next-build`.
  buildCommand: 'npx next build',
};

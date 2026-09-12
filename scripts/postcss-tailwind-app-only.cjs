/**
 * Tailwind (v3), but only for this app's own stylesheets.
 *
 * Third-party packages can ship CSS written for a different Tailwind major —
 * @copilotkit/react-core's v2 entry ships a Tailwind v4 sheet with
 * `@layer base` — and Tailwind v3's PostCSS plugin refuses any file that
 * uses `@layer base` without its own `@tailwind base`. Nothing in
 * node_modules needs our utility scan anyway, so those files pass straight
 * through to autoprefixer untouched.
 *
 * Referenced from postcss.config.mjs in place of `tailwindcss`.
 */
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');

const THIRD_PARTY = /[\\/]node_modules[\\/]/;

function tailwindAppOnly(options = {}) {
  return {
    postcssPlugin: 'tailwind-app-only',
    async Once(root, { result }) {
      const file = (root.source && root.source.input && root.source.input.file) || result.opts.from || '';
      if (THIRD_PARTY.test(file)) return;
      const processed = await postcss([tailwindcss(options)]).process(root, {
        from: result.opts.from,
        to: result.opts.to,
        map: false,
      });
      // Forward dependency messages so content changes still trigger rebuilds.
      for (const message of processed.messages) result.messages.push(message);
    },
  };
}
tailwindAppOnly.postcss = true;

module.exports = tailwindAppOnly;

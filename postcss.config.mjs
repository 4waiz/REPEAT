export default {
  plugins: {
    // Tailwind v3 for the app's own CSS only; third-party sheets pass through.
    // See scripts/postcss-tailwind-app-only.cjs.
    './scripts/postcss-tailwind-app-only.cjs': {},
    autoprefixer: {},
  },
};

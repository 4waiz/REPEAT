import type { Config } from 'tailwindcss';

/**
 * REPEAT design system.
 *
 * Near-black ground, deep navy glass panels, one electric-cyan accent, and a
 * very small amount of glow. Violet is reserved exclusively for Ghost Run,
 * teal for completed actions, amber for anything needing a human.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          // page ground -> raised surfaces
          950: '#04060a',
          900: '#070a11',
          850: '#090d15',
          800: '#0b1019',
          750: '#0e141f',
          700: '#121927',
          600: '#18202f',
          500: '#1f2937',
        },
        edge: {
          // borders, faint -> prominent
          faint: 'rgba(255,255,255,0.045)',
          soft: 'rgba(255,255,255,0.075)',
          DEFAULT: 'rgba(255,255,255,0.11)',
          strong: 'rgba(255,255,255,0.18)',
        },
        mist: {
          // text
          50: '#f2f6fb',
          100: '#e6edf6',
          200: '#c7d3e3',
          300: '#9fb0c6',
          400: '#7386a0',
          500: '#566a84',
          600: '#3e4f66',
        },
        cyan: {
          // the single product accent
          300: '#7fe9ff',
          400: '#38dcff',
          500: '#0fbde4',
          600: '#0a94b8',
          700: '#0b6e8a',
        },
        iris: {
          // ghost run only
          300: '#b4a8ff',
          400: '#8b7cff',
          500: '#6a56f0',
          600: '#5140c4',
        },
        teal: {
          300: '#6ee7c2',
          400: '#2dd4a7',
          500: '#14b98a',
          600: '#0d8f6b',
        },
        amber: {
          300: '#fcd47c',
          400: '#f5b544',
          500: '#dd971f',
        },
        rose: {
          300: '#ffa3a3',
          400: '#ff6b6b',
          500: '#e64545',
        },
      },
      fontFamily: {
        // Deliberately system-local: the demo must render identically with no
        // network. Segoe UI Variable / SF / Inter cover every target machine.
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI Variable Display',
          'Segoe UI',
          'Inter',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'JetBrains Mono',
          'SFMono-Regular',
          'Cascadia Code',
          'Consolas',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.08em' }],
        '3xs': ['0.5625rem', { lineHeight: '0.75rem', letterSpacing: '0.1em' }],
      },
      borderRadius: {
        panel: '14px',
        window: '10px',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 18px 40px -18px rgba(0,0,0,0.9)',
        lift: '0 24px 60px -24px rgba(0,0,0,0.95), 0 1px 0 0 rgba(255,255,255,0.05) inset',
        'glow-cyan': '0 0 0 1px rgba(56,220,255,0.32), 0 0 28px -6px rgba(56,220,255,0.38)',
        'glow-iris': '0 0 0 1px rgba(139,124,255,0.34), 0 0 28px -6px rgba(139,124,255,0.4)',
        'glow-teal': '0 0 0 1px rgba(45,212,167,0.34), 0 0 26px -8px rgba(45,212,167,0.4)',
        'glow-amber': '0 0 0 1px rgba(245,181,68,0.34), 0 0 26px -8px rgba(245,181,68,0.36)',
      },
      keyframes: {
        breathe: {
          '0%,100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.82)', opacity: '0.7' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        'dash-flow': {
          to: { strokeDashoffset: '-24' },
        },
        'sheen-sweep': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'orbit-spin': {
          to: { transform: 'rotate(360deg)' },
        },
        'caret-blink': {
          '0%,49%': { opacity: '1' },
          '50%,100%': { opacity: '0' },
        },
      },
      animation: {
        breathe: 'breathe 3.6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.22,0.61,0.36,1) infinite',
        'dash-flow': 'dash-flow 0.9s linear infinite',
        'sheen-sweep': 'sheen-sweep 2.6s ease-in-out infinite',
        'rise-in': 'rise-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'orbit-spin': 'orbit-spin 3.2s linear infinite',
        'caret-blink': 'caret-blink 1.1s steps(1) infinite',
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [],
};

export default config;

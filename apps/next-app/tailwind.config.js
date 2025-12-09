import { heroui } from '@heroui/theme'

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            foreground: {
              DEFAULT: '#0F172A', // strong slate text
              muted: '#6B7280',
            },
            background: {
              DEFAULT: '#F9FAFB', // app-level background
              surface: '#FFFFFF', // cards, chat bubbles
              subtle: '#F3F4F6', // subtle gray areas
            },
            primary: {
              DEFAULT: '#F44040', // Meetred Red
              hover: '#D62828',
              active: '#B91C1C',
              foreground: '#FFFFFF',
              soft: '#FFE5E5', // soft red bg for badges/pills
            },
            accent: {
              success: '#22C55E',
              warning: '#FACC15',
              danger: '#EF4444',
            },
          },
        },

        dark: {
          colors: {
            foreground: {
              DEFAULT: '#E5E7EB', // near-white
              muted: '#9CA3AF',
            },
            background: {
              DEFAULT: '#050816', // deep indigo/black mix
              surface: '#0B1220', // panels, chat bubbles
              subtle: '#111827', // mid-surface
            },
            primary: {
              DEFAULT: '#F44040', // same brand red
              hover: '#F97373', // brighter in dark mode
              active: '#FECACA',
              foreground: '#FFFFFF',
              soft: '#3B0B0B', // dark, subtle red surface
            },
            accent: {
              success: '#4ADE80',
              warning: '#FDE047',
              danger: '#F87171',
            },
          },
        },
      },
    }),
  ],
}

module.exports = config

import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-cairo)', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      colors: {
        // SASCO green — the SAME brand identity already established in the
        // mobile app (see mobile/lib/core/theme/app_colors.dart). Using the
        // generic blue that was here before meant the web dashboard and the
        // mobile app looked like two unrelated products; this ties them
        // together deliberately.
        brand: {
          50: '#e6f4ec',
          100: '#c2e4d1',
          200: '#93cfb0',
          300: '#5fb88c',
          400: '#369e6c',
          500: '#0c7c42', // primary
          600: '#0a6b39',
          700: '#085c31',
          800: '#064a27',
          900: '#043a1e',
        },
        // Warm amber accent — echoes fuel/energy without competing with
        // the primary green; used sparingly (badges, highlights, charts).
        accent: {
          400: '#f2a93b',
          500: '#e89620',
          600: '#c97f16',
        },
        ink: {
          50: '#f7f8f7',
          100: '#eef0ee',
          200: '#dde2de',
          300: '#b7c0ba',
          400: '#8b968f',
          500: '#5b6b63',
          700: '#2c352f',
          800: '#1a201c',
          900: '#11201a',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(17 32 26 / 0.04), 0 1px 8px -2px rgb(17 32 26 / 0.06)',
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-cairo)', 'Segoe UI', 'Tahoma', 'sans-serif'],
        // Sprint 2 — adopted design system typography. Rubik for body
        // text, Space Grotesk for numerals (paired with the `.num`
        // utility class in globals.css). Used by NEW screens only
        // (sprint 3 onward); existing pages keep the default `sans`.
        ds: ['Rubik', 'Segoe UI', 'Tahoma', 'sans-serif'],
        dsNum: ['Space Grotesk', 'Rubik', 'sans-serif'],
      },
      colors: {
        // SASCO green — the SAME brand identity already established in the
        // mobile app (see mobile/lib/core/theme/app_colors.dart). Using the
        // generic blue that was here before meant the web dashboard and the
        // mobile app looked like two unrelated products; this ties them
        // together deliberately.
        //
        // KEPT AS-IS through the Sprint 2 design system adoption: these
        // are used across all 34 existing pages today, and the roadmap
        // schedules their redesign for LATER sprints (9+), one screen at
        // a time, each independently tested — not a single flash-cut
        // rebrand of the whole live product in one shot.
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

        // Sprint 2 — adopted design system (see final-roadmap-16-sprints.md
        // and the Wardiya/Atheel design handoff's token table). Namespaced
        // under `ds` rather than overwriting the palette above: new Super
        // Admin screens (sprint 3 onward) use `ds-*` classes; existing
        // pages keep using `brand-*`/`ink-*` until their own redesign
        // sprint replaces them one at a time.
        ds: {
          bg: '#F5F6FA',
          surface: '#FFFFFF',
          surfaceLight: '#FAFAFD',
          cardBorder: '#EEEFF5',
          fieldBorder: '#E7E8F0',
          rowDivider: '#F4F5F9',
          rowDivider2: '#F1F2F7',
          text: '#171826',
          textSecondary: '#63667C',
          textMuted: '#6B6E85',
          textDisabled: '#C9CBD9',
          primary: '#7C5CFF',
          primaryDark: '#5B45D6',
          primaryDarker: '#4733B8',
          primaryLight: '#F3F0FE',
          primaryLightBorder: '#D8D3F7',
          primaryTagBorder: '#E4DEFB',
          secondary: '#4ECDC4',
          secondaryDark: '#22A79E',
          secondaryText: '#1B9188',
          secondaryBg: '#E7F8F6',
          coralFrom: '#FF9770',
          coralTo: '#F26A5E',
          success: '#14A87C',
          successText: '#0E7A5A',
          successBg: '#E8F7F1',
          warning: '#E08419',
          warningText: '#A2600C',
          warningBg: '#FFF4E8',
          warningBorder: '#FBE1C4',
          danger: '#EE4C5B',
          dangerText: '#C93745',
          dangerBg: '#FDEEEF',
          dangerBorder: '#FADFE2',
          sidebarFrom: '#191A2C',
          sidebarTo: '#14152A',
          darkCardFrom: '#1E1F35',
          darkCardTo: '#14152A',
          onDark: '#FFFFFF',
          onDarkSecondary: '#9A9DBE',
          onDarkMuted: '#7D80A3',
          onDarkGroupLabel: '#6E7194',
          trackBg: '#F1F2F7',
          trackFillLight: '#E7E8F0',
          trackFillLighter: '#DDDFE9',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(17 32 26 / 0.04), 0 1px 8px -2px rgb(17 32 26 / 0.06)',
        // Sprint 2 design system shadows
        dsCard: '0 1px 2px rgba(23,24,38,.04)',
        dsHover: '0 10px 26px rgba(23,24,38,.08)',
        dsButton: '0 6px 18px rgba(92,69,214,.3)',
        dsDarkCard: '0 10px 30px rgba(20,21,42,.22)',
        dsDrawer: '0 30px 70px rgba(23,24,38,.3)',
        dsMobile: '0 24px 50px rgba(23,24,38,.24)',
      },
      borderRadius: {
        dsCard: '18px',
        dsCardInner: '15px',
        dsField: '12px',
        dsPill: '999px',
        dsAvatar: '11px',
      },
    },
  },
  plugins: [],
};
export default config;

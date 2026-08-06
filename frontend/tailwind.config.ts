import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-cairo)', 'Segoe UI', 'Tahoma', 'sans-serif'],
        // Dashboard rebuild (full redesign) — IBM Plex Sans Arabic
        // for headings/UI chrome (a technical, trustworthy register
        // fitting operational B2B tooling, not a consumer app), Inter
        // for tabular data/numerals (built for number legibility at
        // small sizes — dashboards are read, not admired).
        ds: ['IBM Plex Sans Arabic', 'Segoe UI', 'Tahoma', 'sans-serif'],
        dsNum: ['Inter', 'IBM Plex Sans Arabic', 'sans-serif'],
      },
      colors: {
        // SASCO/Atheel green — the SAME brand identity established in
        // the mobile app (see mobile/lib/core/theme/app_colors.dart).
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

        // Dashboard rebuild — full design system replacement. Green +
        // refined neutrals (charcoal/warm-gray), replacing the earlier
        // violet palette: violet-on-white is one of the three defaults
        // that AI-generated SaaS dashboards cluster around regardless
        // of brand (Stripe/Linear-adjacent), and this product's real
        // identity is the green above — using it here ties the whole
        // platform (web + mobile) to ONE mark instead of two unrelated
        // looks. `ds-*` remains the namespace so no existing screen's
        // className usage needs to change; only what the tokens
        // themselves resolve to.
        ds: {
          bg: '#F7F8F5', // warm neutral, not stark white
          surface: '#FFFFFF',
          surfaceLight: '#FAFAF8',
          cardBorder: '#E9EBE5',
          fieldBorder: '#DEE1D8',
          rowDivider: '#F0F2ED',
          rowDivider2: '#EAECE5',
          text: '#0F1A14', // near-black with a green undertone, not pure black
          textSecondary: '#5C6660',
          textMuted: '#6B756E',
          textDisabled: '#C4CBC2',
          primary: '#0C7C42',
          primaryDark: '#085C31',
          primaryDarker: '#064A27',
          primaryLight: '#E6F4EC',
          primaryLightBorder: '#C2E4D1',
          primaryTagBorder: '#A9D9BC',
          // Muted slate-teal for "notable but not primary" data points —
          // a second SATURATED color competes with the brand green, so
          // this stays deliberately quiet (the design brief's own
          // restraint principle: spend boldness in one place).
          secondary: '#3D6B6E',
          secondaryDark: '#2A4E50',
          secondaryText: '#254345',
          secondaryBg: '#EAF1F1',
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
          // Sidebar/dark-surface family — near-black with a green
          // undertone (matches `text` above) instead of a generic
          // navy-black, so the dark chrome reads as part of THIS
          // brand's family, not a stock admin-template shell.
          sidebarFrom: '#101A14',
          sidebarTo: '#0B120E',
          darkCardFrom: '#16211A',
          darkCardTo: '#0B120E',
          onDark: '#FFFFFF',
          onDarkSecondary: '#9DB0A4',
          onDarkMuted: '#7E9186',
          onDarkGroupLabel: '#66786D',
          trackBg: '#F0F2ED',
          trackFillLight: '#DEE1D8',
          trackFillLighter: '#D2D6C9',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(17 32 26 / 0.04), 0 1px 8px -2px rgb(17 32 26 / 0.06)',
        dsCard: '0 1px 2px rgba(15,26,20,.04)',
        dsHover: '0 10px 26px rgba(15,26,20,.08)',
        dsButton: '0 6px 18px rgba(12,124,66,.28)',
        dsDarkCard: '0 10px 30px rgba(11,18,14,.26)',
        dsDrawer: '0 30px 70px rgba(15,26,20,.3)',
        dsMobile: '0 24px 50px rgba(15,26,20,.24)',
      },
      borderRadius: {
        dsCard: '14px',
        dsCardInner: '11px',
        dsField: '10px',
        dsPill: '999px',
        dsAvatar: '10px',
      },
    },
  },
  plugins: [],
};
export default config;

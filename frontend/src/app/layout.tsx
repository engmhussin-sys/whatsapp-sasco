import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'ساسكو — منصة تواصل وتشغيل فرق العمل',
  description: 'منصة تواصل وتشغيل فرق العمل متعددة اللغات لمحطات ساسكو',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Sprint 2 (design system adoption): Rubik (Arabic + Latin body
            text) + Space Grotesk (numerals — see the `.num` utility in
            globals.css) replace Cairo, per the adopted design system's
            typography spec. Loaded the SAME way as before (a <link>, not
            next/font/google) for the same build-time network-independence
            reason documented in the previous comment — that constraint
            hasn't changed, only the font names have. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600&display=swap"
          rel="stylesheet"
        />
        {/* Applies the saved theme class BEFORE hydration/paint — without
            this, the page would briefly flash light mode even for a user
            who chose dark, then snap to dark a moment later. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              const saved = localStorage.getItem('theme');
              if (saved === 'dark') document.documentElement.classList.add('dark');
            } catch (e) {}`,
          }}
        />
      </head>
      <body
        className="min-h-screen bg-ink-50 text-ink-900 dark:bg-ink-900 dark:text-ink-50"
        style={{ fontFamily: "'Rubik', 'Segoe UI', Tahoma, sans-serif" }}
      >
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

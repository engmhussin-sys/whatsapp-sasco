import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'ساسكو — منصة تواصل وتشغيل فرق العمل',
  description: 'منصة تواصل وتشغيل فرق العمل متعددة اللغات لمحطات ساسكو',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Same typeface as the mobile app (see mobile/pubspec.yaml -> google_fonts Cairo)
            — loaded via a standard <link> rather than next/font/google so the production
            build never depends on reaching Google's font CDN at BUILD time (only the
            end user's browser needs it, at runtime, same as any other web font). This
            deliberately trades Next.js's preferred next/font optimization for build-time
            network independence — the correct tradeoff here since the build environment
            used for this project cannot reach fonts.googleapis.com/fonts.gstatic.com,
            while the actual deployment target (Railway) can reach it fine at runtime. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-ink-50 text-ink-900" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

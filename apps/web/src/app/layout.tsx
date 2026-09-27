import { SerwistProvider } from '@serwist/turbopack/react';
import type { Metadata, Viewport } from 'next';
import { Baloo_2, Geist_Mono, Nunito } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const nunito = Nunito({ variable: '--font-sans', subsets: ['latin'], weight: ['600', '700', '800', '900'] });
const baloo = Baloo_2({ variable: '--font-baloo', subsets: ['latin'], weight: ['600', '700', '800'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const APP_NAME = 'Box Hunt';
const DESCRIPTION = 'Connect. Capture. Conquer. A dots-and-boxes strategy game for 2–4 players.';

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: DESCRIPTION,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: APP_NAME },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF8EC' },
    { media: '(prefers-color-scheme: dark)', color: '#1B1433' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${nunito.variable} ${baloo.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-bold">
        {/* reloadOnOnline off: a reload when the connection returns would cancel an
            in-flight offline navigation (and needlessly interrupt a game). */}
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === 'development'} reloadOnOnline={false}>
          <Providers>{children}</Providers>
        </SerwistProvider>
      </body>
    </html>
  );
}

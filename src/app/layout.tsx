import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { Providers } from './providers';
import { CHROME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'LockIn',
  description:
    'Capture anything in one field. The hierarchy shows whether your days are moving your years.',
  manifest: '/manifest.json',
  applicationName: 'LockIn',
  appleWebApp: { capable: true, title: 'LockIn', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: CHROME.light },
    { media: '(prefers-color-scheme: dark)', color: CHROME.dark },
  ],
};

/**
 * The theme is applied before first paint. A flash of the wrong theme is the
 * one thing a token-driven system cannot fix after the fact.
 */
const THEME_SCRIPT = `(function(){try{
  var m=document.cookie.match(/lockin_theme=(light|dark|system)/);
  var t=m?m[1]:'system';
  var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme',d?'dark':'light');
  var c=document.cookie.match(/lockin_density=(comfortable|compact)/);
  document.documentElement.setAttribute('data-density',c?c[1]:'comfortable');
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Outfit:wght@400;500&family=Geist+Mono:wght@400&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

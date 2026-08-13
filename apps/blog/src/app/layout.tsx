import type { Metadata, Viewport } from 'next';
import { FlavourBootstrap, ThemeStyles } from '../components/ThemeStyles';
import './global.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://sfaizh.top'),
  title: {
    default: 'sfaizh.top engineering blog',
    template: '%s · sfaizh.top',
  },
  description: 'A blog containing experiments in software and systems engineering',
  applicationName: 'sfaizh.top',
  authors: [{ name: 'Faizan', url: 'https://sfaizh.top' }],
  openGraph: {
    type: 'website',
    siteName: 'sfaizh.top',
    title: 'sfaizh.top engineering blog',
    description: 'A blog containing experiments in software and systems engineering',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#1e1e2e',
  width: 'device-width',
  initialScale: 1,
  // The terminal owns the viewport; letting it zoom on input focus is jarring.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-flavour="mocha" suppressHydrationWarning>
      <head>
        <ThemeStyles />
        <FlavourBootstrap />
      </head>
      <body>{children}</body>
    </html>
  );
}

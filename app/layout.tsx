import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from '@/components/providers'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: {
    default: 'E-TicketsZW | Zimbabwe\'s Premier Event Ticketing Platform',
    template: '%s | E-TicketsZW'
  },
  description: 'Buy and sell tickets for concerts, comedy shows, marathons, festivals, and more across Zimbabwe. Secure payments via Stripe and Paynow.',
  keywords: ['tickets', 'events', 'Zimbabwe', 'concerts', 'comedy', 'marathon', 'festivals', 'Harare', 'Bulawayo'],
  authors: [{ name: 'E-TicketsZW' }],
  creator: 'E-TicketsZW',
  publisher: 'E-TicketsZW',
  metadataBase: new URL('https://eticket.co.zw'),
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    url: 'https://eticket.co.zw',
    siteName: 'E-TicketsZW',
    title: 'E-TicketsZW | Zimbabwe\'s Premier Event Ticketing Platform',
    description: 'Buy and sell tickets for concerts, comedy shows, marathons, festivals, and more across Zimbabwe.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'E-TicketsZW | Zimbabwe\'s Premier Event Ticketing Platform',
    description: 'Buy and sell tickets for concerts, comedy shows, marathons, festivals, and more across Zimbabwe.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased min-h-screen overflow-x-hidden">
        <Providers>
          {children}
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

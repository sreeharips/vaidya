import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import './globals.css'

const fontSerif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const fontSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
})

// Noindex during beta — flip to true when going live
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// Root layout — global CSS and fonts load once for every route.
// Per-locale metadata lives under app/[lang]/.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${fontSerif.variable} ${fontSans.variable}`}
    >
      <body className="min-h-screen bg-cream font-sans text-slate antialiased">
        {children}
      </body>
    </html>
  )
}

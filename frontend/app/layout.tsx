import './globals.css'

// Root layout — minimal shell. Per-locale metadata is generated in app/[lang]/page.tsx.
// The <html lang> attribute defaults to "en"; locale-specific pages are served under /{lang}/.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}

/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n.ts')

// Derive allowed origins from the public app URL at build/start time
const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
const prodOrigins = appUrl
  ? [appUrl.replace(/^https?:\/\//, '')]
  : []

const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'localhost:3001',
        '127.0.0.1:3000',
        ...prodOrigins,
      ],
    },
  },
}

module.exports = withNextIntl(nextConfig)

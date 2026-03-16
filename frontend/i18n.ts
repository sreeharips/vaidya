import { getRequestConfig } from 'next-intl/server'

const SUPPORTED_LOCALES = ['en', 'ar', 'de', 'fr', 'ml', 'hi'] as const

export default getRequestConfig(async ({ locale }) => {
  const safeLocale = SUPPORTED_LOCALES.includes(locale as typeof SUPPORTED_LOCALES[number])
    ? locale
    : 'en'

  return {
    messages: (await import(`./messages/${safeLocale}.json`)).default,
  }
})

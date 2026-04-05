import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { AuthProvider } from '@/contexts/AuthContext'
import { DisplayCurrencyProvider } from '@/contexts/DisplayCurrencyContext'
import NavBar from '@/components/NavBar'
import ToastContainer from '@/components/ToastContainer'
import { COOKIE_DISPLAY_CURRENCY, isDisplayCurrencyCode, type DisplayCurrencyCode } from '@/lib/currency'

export default async function LocaleLayout({
  children,
  params: { lang },
}: {
  children: React.ReactNode
  params: { lang: string }
}) {
  setRequestLocale(lang)
  const messages = await getMessages()
  const raw = cookies().get(COOKIE_DISPLAY_CURRENCY)?.value
  const initialCurrency: DisplayCurrencyCode = isDisplayCurrencyCode(raw) ? raw : 'INR'

  return (
    <NextIntlClientProvider locale={lang} messages={messages}>
      <DisplayCurrencyProvider initialCurrency={initialCurrency} locale={lang}>
        <AuthProvider>
          <NavBar />
          {children}
          <ToastContainer />
        </AuthProvider>
      </DisplayCurrencyProvider>
    </NextIntlClientProvider>
  )
}

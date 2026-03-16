import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import NavBar from '@/components/NavBar'

export default async function LocaleLayout({
  children,
  params: { lang },
}: {
  children: React.ReactNode
  params: { lang: string }
}) {
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={lang} messages={messages}>
      <NavBar />
      {children}
    </NextIntlClientProvider>
  )
}

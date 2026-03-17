import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { AuthProvider } from '@/contexts/AuthContext'
import NavBar from '@/components/NavBar'
import ToastContainer from '@/components/ToastContainer'

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
      <AuthProvider>
        <NavBar />
        {children}
        <ToastContainer />
      </AuthProvider>
    </NextIntlClientProvider>
  )
}

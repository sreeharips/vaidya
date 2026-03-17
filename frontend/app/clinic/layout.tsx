import './clinic.css'
import { AuthProvider } from '@/contexts/AuthContext'

export const metadata = {
  title: 'Vaidya Clinic Portal',
}

export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

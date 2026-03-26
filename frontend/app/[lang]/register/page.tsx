import Link from 'next/link'

export default function RegisterPage({ params }: { params: { lang: string } }) {
  const lang = params.lang || 'en'
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--cream)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontSize: '28px',
            fontWeight: 500,
            color: 'var(--forest)',
            marginBottom: '12px',
          }}
        >
          ✦ AyuRetreats
        </div>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontSize: '22px',
            fontWeight: 400,
            color: 'var(--forest)',
            marginBottom: '10px',
          }}
        >
          Registration coming soon
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.6 }}>
          Account registration will be available shortly.
          In the meantime, you can browse retreats and book as a guest.
        </p>
        <Link
          href={`/${lang}/login`}
          style={{ fontSize: '13px', color: 'var(--forest)', fontWeight: 500, textDecoration: 'none' }}
        >
          ← Back to sign in
        </Link>
      </div>
    </main>
  )
}

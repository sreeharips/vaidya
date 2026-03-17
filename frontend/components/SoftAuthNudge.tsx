'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

interface SoftAuthNudgeProps {
  /**
   * The main nudge message. Keep it short and benefit-focused.
   * e.g. "Sign in to save your Prakriti profile across devices."
   */
  message: string
  /** Label for the dismiss action. Defaults to "Continue as guest". */
  dismissLabel?: string
  /** Override the lang segment. If omitted, reads from URL params. */
  lang?: string
}

/**
 * SoftAuthNudge — a non-blocking, dismissible auth prompt.
 *
 * Core rule: it appears ALONGSIDE or AFTER the user's action, never instead of it.
 * Use it when a guest does something that would benefit from being signed in.
 */
export default function SoftAuthNudge({
  message,
  dismissLabel = 'Continue as guest',
  lang: propLang,
}: SoftAuthNudgeProps) {
  const [dismissed, setDismissed] = useState(false)
  const params = useParams()
  const lang = propLang ?? ((params?.lang as string) || 'en')
  const loginHref = `/${lang}/login`

  if (dismissed) return null

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        background: 'var(--gold-lt)',
        borderLeft: '3px solid var(--gold)',
        borderRadius: 'var(--r-sm)',
        marginTop: '16px',
        flexWrap: 'wrap',
      }}
    >
      {/* Message */}
      <p
        style={{
          flex: 1,
          fontSize: '13px',
          color: 'var(--bark)',
          lineHeight: 1.55,
          minWidth: '180px',
          margin: 0,
        }}
      >
        {message}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        <Link
          href={loginHref}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--bark)',
            background: 'transparent',
            border: '1px solid rgba(184,134,44,0.4)',
            padding: '5px 14px',
            borderRadius: 'var(--r-xl)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition)',
          }}
        >
          Sign in
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            fontSize: '12px',
            color: 'var(--muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 2px',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--sans)',
          }}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  )
}

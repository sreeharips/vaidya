'use client'

import { useRouter } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()
  return (
    <button className="back-btn" onClick={() => router.back()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back to results
    </button>
  )
}

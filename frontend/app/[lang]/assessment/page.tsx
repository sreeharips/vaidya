'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { showToast } from '@/lib/toast'
import SoftAuthNudge from '@/components/SoftAuthNudge'

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuestionOption { index: number; text: string }
interface Question { id: string; category: string; text: string; options: QuestionOption[] }

interface ClinicMatch {
  id: string; slug: string; name: string; tier: number
  district: string | null; rating: number | null
  pricing_min: number | null; pricing_max: number | null
}

interface AssessmentResult {
  vata_pct: number; pitta_pct: number; kapha_pct: number
  primary_type: string; secondary_type: string | null; dosha_type: string
  tendencies: string[]; treatment_affinities: string[]; retreat_focus: string
  matched_clinics: ClinicMatch[]
}

type Phase = 'intro' | 'questions' | 'submitting' | 'results'

// ── Constants ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const CATEGORY_LABELS: Record<string, string> = {
  physical:  'Body & Appearance',
  digestion: 'Digestion & Appetite',
  mind:      'Mind & Emotions',
  lifestyle: 'Lifestyle & Energy',
}

const DOSHA_INFO: Record<string, {
  bar: string; bg: string; textColor: string; border: string
  tagline: string; desc: string
}> = {
  vata: {
    bar: '#8B6E5A', bg: 'var(--bark-lt)', textColor: 'var(--bark)', border: 'rgba(107,79,58,.2)',
    tagline: 'Creative · Quick · Light',
    desc: 'Vata types are creative, energetic, and quick-thinking. When balanced, you are enthusiastic and vital. When imbalanced, you may experience anxiety, dry skin, and digestive irregularity.',
  },
  pitta: {
    bar: '#2D5440', bg: 'var(--forest-lt)', textColor: 'var(--forest2)', border: 'rgba(30,61,47,.15)',
    tagline: 'Focused · Driven · Analytical',
    desc: 'Pitta types are focused, driven, and analytical. When balanced, you are confident and decisive. When imbalanced, you may experience inflammation, acidity, and irritability.',
  },
  kapha: {
    bar: '#B8862C', bg: 'var(--gold-lt)', textColor: 'var(--bark)', border: 'rgba(184,134,44,.2)',
    tagline: 'Steady · Compassionate · Resilient',
    desc: 'Kapha types are steady, compassionate, and resilient. When balanced, you are calm and nurturing. When imbalanced, you may experience sluggishness, weight gain, and congestion.',
  },
}

function capitalize(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AssessmentPage() {
  const params = useParams<{ lang: string }>()
  const lang = params?.lang ?? 'en'

  const { isAuthenticated, updatePreferences } = useAuth()

  const [phase, setPhase] = useState<Phase>('intro')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [selecting, setSelecting] = useState(false)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [showPrakritiNudge, setShowPrakritiNudge] = useState(false)

  async function startAssessment() {
    setLoadingQuestions(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/assessment/questions?lang=${lang}`)
      if (!res.ok) throw new Error('Failed to load questions')
      const qs: Question[] = await res.json()
      setQuestions(qs)
      setCurrentIdx(0)
      setAnswers({})
      setPhase('questions')
    } catch {
      setError('Could not load the assessment. Is the backend running?')
    } finally {
      setLoadingQuestions(false)
    }
  }

  function selectOption(optionIndex: number) {
    if (selecting) return
    const q = questions[currentIdx]
    const newAnswers = { ...answers, [q.id]: optionIndex }
    setAnswers(newAnswers)
    setSelecting(true)

    setTimeout(() => {
      setSelecting(false)
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(i => i + 1)
      } else {
        submitAnswers(newAnswers)
      }
    }, 380)
  }

  async function submitAnswers(finalAnswers: Record<string, number>) {
    setPhase('submitting')
    try {
      const res = await fetch(`${API_BASE}/api/assessment/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.entries(finalAnswers).map(([question_id, option_index]) => ({
            question_id,
            option_index,
          })),
          session_type: 'form',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Scoring failed')
      }
      const r: AssessmentResult = await res.json()
      setResult(r)
      setPhase('results')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // Save to preferences (works for both guests via session cookie and authenticated users)
      updatePreferences({
        vata_pct: r.vata_pct,
        pitta_pct: r.pitta_pct,
        kapha_pct: r.kapha_pct,
        primary_type: r.primary_type,
        secondary_type: r.secondary_type ?? undefined,
      }).then(() => {
        if (isAuthenticated) {
          showToast('Prakriti profile saved to your account')
        } else {
          setShowPrakritiNudge(true)
        }
      }).catch(() => null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPhase('questions')
    }
  }

  const progress = questions.length > 0 ? (currentIdx / questions.length) * 100 : 0

  // ── INTRO ──────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="assessment-wrap">
        {/* Eyebrow */}
        <p className="assessment-category" style={{ textAlign: 'center' }}>
          Prakriti Assessment
        </p>

        {/* Heading */}
        <h1 style={{
          fontFamily: 'var(--serif)',
          fontSize: '40px',
          fontWeight: 400,
          color: 'var(--forest)',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          textAlign: 'center',
          marginBottom: '16px',
        }}>
          Discover Your<br />
          <em style={{ fontStyle: 'italic', color: 'var(--gold)', fontWeight: 300 }}>Prakriti</em>
        </h1>

        <p style={{
          fontSize: '16px',
          color: 'var(--muted)',
          lineHeight: 1.7,
          textAlign: 'center',
          marginBottom: '40px',
        }}>
          Prakriti is your unique Ayurvedic constitution — the combination of Vata, Pitta,
          and Kapha energies that defines your physical, mental, and emotional nature.
          Understanding it helps us match you to the right doctor, treatments, and retreat programme.
        </p>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '32px',
          marginBottom: '40px',
          padding: '20px',
          background: 'var(--white)',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)',
        }}>
          {[
            { val: '22', label: 'Questions' },
            { val: '8 min', label: 'Typical time' },
            { val: 'Free', label: 'No registration' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', color: 'var(--forest)', fontWeight: 500 }}>
                {s.val}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '20px 24px',
          marginBottom: '32px',
        }}>
          {[
            { n: '1', text: 'Answer 22 questions about your body, digestion, mind and lifestyle — be honest, not aspirational.' },
            { n: '2', text: 'Receive your personalised Prakriti profile: your dominant dosha(s) and health tendencies.' },
            { n: '3', text: 'See matched clinics and doctors in Kerala whose specialisations align with your constitution.' },
          ].map(step => (
            <div key={step.n} className="assessment-step">
              <div className="assessment-step-num">{step.n}</div>
              <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6, paddingTop: '2px' }}>
                {step.text}
              </p>
            </div>
          ))}
        </div>

        {error && (
          <p style={{ fontSize: '14px', color: '#c0392b', marginBottom: '16px', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          className="assessment-cta-btn"
          onClick={startAssessment}
          disabled={loadingQuestions}
        >
          {loadingQuestions ? 'Loading…' : 'Begin Prakriti Assessment →'}
        </button>

        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '16px', lineHeight: 1.6 }}>
          Your answers are anonymous. No account required. Results are educational, not medical advice.
        </p>
      </div>
    )
  }

  // ── QUESTIONS ──────────────────────────────────────────────────────────────

  if (phase === 'questions') {
    const q = questions[currentIdx]
    const selectedOption = answers[q.id] ?? null

    return (
      <div className="assessment-wrap">
        {/* Progress bar */}
        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Question {currentIdx + 1} of {questions.length}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {Math.round(progress)}% complete
          </span>
        </div>
        <div className="assessment-progress-track">
          <div className="assessment-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Question card — key forces remount + fadeUp animation on each advance */}
        <div key={currentIdx} className="animate-fade-up">
          <p className="assessment-category">
            {CATEGORY_LABELS[q.category] ?? q.category}
          </p>

          <p className="assessment-question">{q.text}</p>

          <div>
            {q.options.map(opt => (
              <button
                key={opt.index}
                className={`q-option${selectedOption === opt.index ? ' selected' : ''}`}
                onClick={() => selectOption(opt.index)}
                disabled={selecting}
              >
                <span className="q-option-dot" />
                {opt.text}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px' }}>
          {currentIdx > 0 ? (
            <button
              className="back-btn"
              onClick={() => setCurrentIdx(i => i - 1)}
              disabled={selecting}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous
            </button>
          ) : (
            <button className="back-btn" onClick={() => setPhase('intro')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          )}

          {/* Skip to next (unanswered) */}
          {currentIdx < questions.length - 1 && (
            <button
              style={{
                fontSize: '13px',
                color: 'var(--muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color var(--transition)',
              }}
              onClick={() => setCurrentIdx(i => i + 1)}
            >
              Skip →
            </button>
          )}
        </div>

        {error && (
          <p style={{ fontSize: '13px', color: '#c0392b', marginTop: '16px', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  // ── SUBMITTING ─────────────────────────────────────────────────────────────

  if (phase === 'submitting') {
    return (
      <div className="assessment-wrap" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '24px' }}>
          {/* Animated leaf icon */}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--forest2)" strokeWidth="1.4"
            style={{ animation: 'fadeUp 0.6s ease both' }}>
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
          </svg>
        </div>
        <p style={{ fontFamily: 'var(--serif)', fontSize: '24px', color: 'var(--forest)', marginBottom: '8px' }}>
          Calculating your Prakriti…
        </p>
        <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
          Analysing your answers across body, digestion, mind and lifestyle.
        </p>
        {/* Animated bar shimmer */}
        <div style={{ maxWidth: '320px', margin: '32px auto 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {['Vata', 'Pitta', 'Kapha'].map((d, i) => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', width: '44px' }}>{d}</span>
              <div className="skeleton" style={{ flex: 1, height: '8px', borderRadius: '4px', animationDelay: `${i * 0.2}s` }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── RESULTS ────────────────────────────────────────────────────────────────

  if (phase === 'results' && result) {
    const primary = result.primary_type.toLowerCase()
    const secondary = result.secondary_type?.toLowerCase() ?? null
    const info = DOSHA_INFO[primary] ?? DOSHA_INFO.vata

    const bars: Array<{ label: string; pct: number; color: string }> = [
      { label: 'Vata',  pct: result.vata_pct,  color: DOSHA_INFO.vata.bar },
      { label: 'Pitta', pct: result.pitta_pct, color: DOSHA_INFO.pitta.bar },
      { label: 'Kapha', pct: result.kapha_pct, color: DOSHA_INFO.kapha.bar },
    ]

    const doshaLabel = result.secondary_type
      ? `${capitalize(result.primary_type)} — ${capitalize(result.secondary_type)}`
      : capitalize(result.primary_type)

    return (
      <div className="assessment-wrap animate-fade-up">

        {/* ── Result header ───────────────────────────────────── */}
        <div style={{
          padding: '32px',
          borderRadius: 'var(--r-lg)',
          background: info.bg,
          border: `1px solid ${info.border}`,
          marginBottom: '32px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>
            Your Prakriti
          </p>
          <h1 style={{
            fontFamily: 'var(--serif)',
            fontSize: '42px',
            fontWeight: 400,
            color: info.textColor,
            letterSpacing: '-0.02em',
            marginBottom: '6px',
          }}>
            {doshaLabel}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px', fontStyle: 'italic' }}>
            {info.tagline}
          </p>

          {/* Dosha bars */}
          <div style={{ maxWidth: '380px', margin: '0 auto' }}>
            {bars.map(b => (
              <div key={b.label} className="dosha-bar-row">
                <span className="dosha-bar-label">{b.label}</span>
                <div className="dosha-bar-track">
                  <div className="dosha-bar-fill" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
                <span className="dosha-bar-pct">{b.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Description ──────────────────────────────────────── */}
        <div className="profile-section">
          <div className="profile-section-title">What this means</div>
          <p style={{ fontSize: '15px', lineHeight: 1.8, color: 'var(--muted)' }}>
            {info.desc}
          </p>
          {result.retreat_focus && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
              <span style={{ fontSize: '13px', color: 'var(--bark)', fontWeight: 500 }}>
                Ideal retreat focus: {result.retreat_focus}
              </span>
            </div>
          )}
        </div>

        {/* ── Tendencies ───────────────────────────────────────── */}
        {result.tendencies.length > 0 && (
          <div className="profile-section">
            <div className="profile-section-title">Your health tendencies</div>
            <div>
              {result.tendencies.map((t, i) => (
                <div key={i} className="tendency-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recommended treatments ───────────────────────────── */}
        {result.treatment_affinities.length > 0 && (
          <div className="profile-section">
            <div className="profile-section-title">Recommended treatments</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {result.treatment_affinities.map(t => (
                <span key={t} className="treatment-tag">{capitalize(t)}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Matched clinics ──────────────────────────────────── */}
        {result.matched_clinics.length > 0 && (
          <div className="profile-section">
            <div className="profile-section-title">Clinics matched to your Prakriti</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.matched_clinics.map(c => (
                <Link
                  key={c.id}
                  href={`/${lang}/clinics/${c.slug}`}
                  className="clinic-mini-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <p style={{ fontFamily: 'var(--serif)', fontSize: '17px', color: 'var(--forest)', fontWeight: 400 }}>
                      {c.name}
                    </p>
                    <span style={{
                      fontSize: '11px', fontWeight: 500, padding: '3px 10px',
                      borderRadius: '10px', flexShrink: 0, marginLeft: '8px',
                      background: c.tier === 2 ? 'var(--gold-lt)' : 'var(--forest-lt)',
                      color: c.tier === 2 ? 'var(--bark)' : 'var(--forest2)',
                    }}>
                      {c.tier === 2 ? 'Certified Authentic' : 'Verified'} · Tier {c.tier}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {c.district && (
                      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{c.district}, Kerala</span>
                    )}
                    {c.rating != null && (
                      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        <span style={{ color: 'var(--gold)' }}>★</span> {c.rating.toFixed(1)}
                      </span>
                    )}
                    {c.pricing_min != null && (
                      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        from ${c.pricing_min}/day
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Guest nudge ──────────────────────────────────────── */}
        {showPrakritiNudge && (
          <SoftAuthNudge
            message="Your Prakriti profile is saved for this session. Sign in to keep it permanently across devices."
            lang={lang}
          />
        )}

        {/* ── CTAs ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <Link
            href={`/${lang}/search?prakriti=${result.primary_type}`}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              fontFamily: 'var(--sans)',
              fontSize: '15px',
              fontWeight: 500,
              padding: '14px',
              borderRadius: 'var(--r-xl)',
              background: 'var(--forest)',
              color: 'var(--white)',
              textDecoration: 'none',
              transition: 'background var(--transition)',
            }}
          >
            Find matching doctors & clinics →
          </Link>

          <button
            onClick={() => {
              setResult(null)
              setAnswers({})
              setCurrentIdx(0)
              setPhase('intro')
            }}
            style={{
              width: '100%',
              fontFamily: 'var(--sans)',
              fontSize: '14px',
              padding: '12px',
              borderRadius: 'var(--r-xl)',
              border: '1.5px solid var(--border2)',
              background: 'transparent',
              color: 'var(--muted)',
              cursor: 'pointer',
              transition: 'all var(--transition)',
            }}
          >
            Retake assessment
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '20px', lineHeight: 1.6 }}>
          Results are educational guidance only — not a medical diagnosis.
          Always consult a qualified vaidya for personalised clinical advice.
        </p>
      </div>
    )
  }

  return null
}

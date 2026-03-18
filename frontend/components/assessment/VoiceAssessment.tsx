'use client'

/**
 * VoiceAssessment.tsx
 *
 * Handles the voice flow for the Prakriti assessment.
 * For each question:
 *   1. Play TTS audio of the spoken_prompt (via Sarvam AI)
 *   2. Record the user's spoken answer (MediaRecorder)
 *   3. Send to /api/voice/transcribe → STT + keyword intent match
 *   4a. High confidence (≥ 0.6): brief confirm → auto-advance
 *   4b. Low confidence: show reask audio + 3 manual option buttons
 *
 * When all 22 questions are answered, calls onComplete(answers) which
 * feeds into the existing /api/assessment/score endpoint — same as text form.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface VoiceQuestion {
  id: string
  category: string
  text: string
  spoken_prompt: string
  reask_prompt: string
  options: Array<{ index: number; text: string }>
}

interface TranscribeResult {
  transcript: string
  option_index: number | null
  confidence: number
  matched_words: string[]
  needs_reask: boolean
  reask_prompt: string | null
}

interface VoiceAssessmentProps {
  questions: VoiceQuestion[]
  lang: string
  onComplete: (answers: Record<string, number>) => void
  onBack: () => void
}

type VoicePhase =
  | 'loading_audio'    // fetching TTS
  | 'playing'          // playing question audio
  | 'ready'            // waiting for user to tap record
  | 'recording'        // actively recording
  | 'processing'       // uploading + STT + intent
  | 'confirm'          // high confidence — show match briefly
  | 'reask'            // low confidence — show manual options

// ── Audio helpers ──────────────────────────────────────────────────────────────

function base64ToAudioUrl(b64: string, mimeType = 'audio/wav'): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

function getBestMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function VoiceAssessment({ questions, lang, onComplete, onBack }: VoiceAssessmentProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('loading_audio')
  const [transcript, setTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [matchedOption, setMatchedOption] = useState<number | null>(null)
  const [matchedWords, setMatchedWords] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioPlaying, setAudioPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioUrlsRef = useRef<string[]>([])

  const question = questions[currentIdx]
  const progress = ((currentIdx) / questions.length) * 100

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      audioUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  // Fetch TTS and play when question changes
  const loadAndPlayQuestion = useCallback(async (prompt: string) => {
    setVoicePhase('loading_audio')
    setTranscript('')
    setMatchedOption(null)
    setMatchedWords([])
    setConfidence(0)
    setError(null)

    try {
      const res = await fetch(`${API}/api/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt, lang }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const data = await res.json()

      const url = base64ToAudioUrl(data.audio_b64, 'audio/wav')
      audioUrlsRef.current.push(url)

      // Stop any previous audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }

      const audio = new Audio(url)
      audioRef.current = audio
      setVoicePhase('playing')
      setAudioPlaying(true)

      audio.onended = () => {
        setAudioPlaying(false)
        setVoicePhase('ready')
      }
      audio.onerror = () => {
        setAudioPlaying(false)
        setVoicePhase('ready') // degrade gracefully — still let user record
      }
      await audio.play()
    } catch {
      // TTS failed — still allow recording
      setVoicePhase('ready')
      setAudioPlaying(false)
    }
  }, [lang])

  useEffect(() => {
    if (question) {
      loadAndPlayQuestion(question.spoken_prompt)
    }
  }, [currentIdx, question, loadAndPlayQuestion])

  // ── Recording ─────────────────────────────────────────────────────────────

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = getBestMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(200)

      setVoicePhase('recording')
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch {
      setError('Could not access microphone. Please check your browser permissions.')
    }
  }

  async function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    return new Promise<void>(resolve => {
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        await transcribeAudio(blob, mimeType)
        resolve()
      }
      recorder.stop()
    })
  }

  async function transcribeAudio(blob: Blob, mimeType: string) {
    setVoicePhase('processing')

    const formData = new FormData()
    formData.append('audio', blob, `recording.${mimeType.split('/')[1]?.split(';')[0] ?? 'webm'}`)
    formData.append('question_id', question.id)
    formData.append('lang', lang)

    try {
      const res = await fetch(`${API}/api/voice/transcribe`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Transcription failed')
      const data: TranscribeResult = await res.json()

      setTranscript(data.transcript)
      setConfidence(data.confidence)
      setMatchedOption(data.option_index)
      setMatchedWords(data.matched_words)

      if (!data.needs_reask && data.option_index !== null) {
        setVoicePhase('confirm')
        // Auto-advance after 2s confirmation
        setTimeout(() => advance(data.option_index!), 2000)
      } else {
        // Low confidence — play reask audio then show options
        setVoicePhase('reask')
        if (data.reask_prompt) {
          try {
            const ttsRes = await fetch(`${API}/api/voice/tts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: data.reask_prompt, lang }),
            })
            if (ttsRes.ok) {
              const ttsData = await ttsRes.json()
              const url = base64ToAudioUrl(ttsData.audio_b64, 'audio/wav')
              audioUrlsRef.current.push(url)
              const audio = new Audio(url)
              audioRef.current = audio
              await audio.play()
            }
          } catch { /* reask audio failed — options still shown */ }
        }
      }
    } catch {
      setError('Could not process your answer. Please try again or choose an option below.')
      setVoicePhase('reask')
    }
  }

  function advance(optionIndex: number) {
    const newAnswers = { ...answers, [question.id]: optionIndex }
    setAnswers(newAnswers)

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1)
    } else {
      onComplete(newAnswers)
    }
  }

  function replayQuestion() {
    loadAndPlayQuestion(question.spoken_prompt)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const categoryLabel: Record<string, string> = {
    physical:  'Body & Appearance',
    digestion: 'Digestion & Appetite',
    mind:      'Mind & Emotions',
    lifestyle: 'Lifestyle & Energy',
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>

      {/* Progress */}
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Question {currentIdx + 1} of {questions.length}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{Math.round(progress)}% complete</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: 'var(--forest)', width: `${progress}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* Question text */}
      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
        {categoryLabel[question.category] ?? question.category}
      </p>
      <p style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--forest)', lineHeight: 1.35, marginBottom: 28 }}>
        {question.text}
      </p>

      {/* Voice interaction card */}
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: 28,
        marginBottom: 20,
        textAlign: 'center',
      }}>

        {/* Loading TTS */}
        {voicePhase === 'loading_audio' && (
          <div style={{ padding: '20px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--forest-lt)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>🎙</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>Preparing audio…</p>
          </div>
        )}

        {/* Playing question audio */}
        {voicePhase === 'playing' && (
          <div style={{ padding: '20px 0' }}>
            <AudioWave />
            <p style={{ fontSize: 14, color: 'var(--forest)', marginTop: 16, fontWeight: 500 }}>
              Listening to the question…
            </p>
            <button
              onClick={() => { audioRef.current?.pause(); setVoicePhase('ready') }}
              style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Skip audio →
            </button>
          </div>
        )}

        {/* Ready to record */}
        {voicePhase === 'ready' && (
          <div style={{ padding: '12px 0' }}>
            <button
              onClick={startRecording}
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'var(--forest)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 20px rgba(30,61,47,0.3)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
            >
              <MicIcon />
            </button>
            <p style={{ fontSize: 14, color: 'var(--slate)', fontWeight: 500 }}>Tap to speak your answer</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Speak naturally — in {LANG_NAMES[lang] ?? lang}</p>
            <button onClick={replayQuestion} style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              ↻ Replay question
            </button>
          </div>
        )}

        {/* Recording */}
        {voicePhase === 'recording' && (
          <div style={{ padding: '12px 0' }}>
            <button
              onClick={stopRecording}
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: '#c53030', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                animation: 'pulse-record 1.5s ease infinite',
                boxShadow: '0 4px 20px rgba(197,48,48,0.4)',
              }}
            >
              <StopIcon />
            </button>
            <p style={{ fontSize: 14, color: '#c53030', fontWeight: 500 }}>
              Recording… {recordingSeconds}s
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Tap to stop</p>
            {recordingSeconds >= 15 && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                Sounds good — tap stop when you're done
              </p>
            )}
          </div>
        )}

        {/* Processing */}
        {voicePhase === 'processing' && (
          <div style={{ padding: '20px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--forest-lt)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⟳</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>Understanding your answer…</p>
            {transcript && (
              <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 10, fontStyle: 'italic', background: 'var(--cream)', padding: '8px 12px', borderRadius: 'var(--r-sm)' }}>
                "{transcript}"
              </p>
            )}
          </div>
        )}

        {/* Confirmed match */}
        {voicePhase === 'confirm' && matchedOption !== null && (
          <div style={{ padding: '12px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--forest-lt)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 28, color: 'var(--forest)' }}>✓</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--forest)', fontWeight: 600, marginBottom: 8 }}>Got it!</p>
            {transcript && (
              <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 8 }}>
                "{transcript}"
              </p>
            )}
            <div style={{ background: 'var(--forest-lt)', border: '1px solid rgba(30,61,47,0.15)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 500 }}>
                {question.options[matchedOption]?.text}
              </p>
            </div>
            {matchedWords.length > 0 && !matchedWords.includes('[haiku]') && (
              <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                Matched on: {matchedWords.slice(0, 3).join(', ')}
              </p>
            )}
            <ConfidenceBar confidence={confidence} />
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Advancing in 2 seconds…</p>
          </div>
        )}

        {/* Reask — low confidence or STT failure */}
        {voicePhase === 'reask' && (
          <div style={{ padding: '8px 0' }}>
            {transcript ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>I heard:</p>
                <p style={{ fontSize: 13, color: 'var(--slate)', fontStyle: 'italic', background: 'var(--cream)', padding: '8px 12px', borderRadius: 'var(--r-sm)', marginBottom: 16 }}>
                  "{transcript}"
                </p>
                {confidence > 0 && <ConfidenceBar confidence={confidence} />}
                <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 12, marginTop: 12 }}>
                  Please choose the closest match:
                </p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Please choose one of the options below:
              </p>
            )}

            {/* Manual option buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {question.options.map(opt => (
                <button
                  key={opt.index}
                  onClick={() => advance(opt.index)}
                  style={{
                    width: '100%', padding: '12px 16px',
                    background: matchedOption === opt.index ? 'var(--forest-lt)' : 'var(--white)',
                    border: `1.5px solid ${matchedOption === opt.index ? 'var(--forest)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)', cursor: 'pointer',
                    textAlign: 'left', fontSize: 13, color: 'var(--slate)',
                    transition: 'all 0.15s', fontFamily: 'var(--sans)',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cream)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = matchedOption === opt.index ? 'var(--forest-lt)' : 'var(--white)' }}
                >
                  {opt.text}
                </button>
              ))}
            </div>

            {/* Retry voice */}
            <button
              onClick={() => setVoicePhase('ready')}
              style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              🎙 Try speaking again
            </button>
          </div>
        )}

        {error && (
          <p style={{ fontSize: 12, color: '#c53030', marginTop: 12 }}>{error}</p>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={currentIdx === 0 ? onBack : () => setCurrentIdx(i => i - 1)}
          style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← {currentIdx === 0 ? 'Back' : 'Previous'}
        </button>
        {voicePhase !== 'recording' && voicePhase !== 'processing' && currentIdx < questions.length - 1 && (
          <button
            onClick={() => advance(answers[question.id] ?? 1)} // use last answer or middle option as default
            style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Skip →
          </button>
        )}
      </div>

      {/* Pulse animation style */}
      <style>{`
        @keyframes pulse-record {
          0%, 100% { box-shadow: 0 4px 20px rgba(197,48,48,0.4); }
          50%       { box-shadow: 0 4px 40px rgba(197,48,48,0.7), 0 0 0 12px rgba(197,48,48,0.1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50%       { transform: scaleY(1.4); }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="none">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}

function AudioWave() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 48 }}>
      {[0, 0.2, 0.4, 0.6, 0.8, 1.0, 0.8, 0.6, 0.4, 0.2].map((delay, i) => (
        <div
          key={i}
          style={{
            width: 4, height: 24, borderRadius: 2, background: 'var(--forest)',
            animation: `wave 0.9s ease-in-out ${delay}s infinite`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 70 ? 'var(--forest)' : pct >= 50 ? 'var(--gold)' : '#c53030'
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
        <span>Confidence</span>
        <span style={{ color, fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

const LANG_NAMES: Record<string, string> = {
  ml: 'Malayalam',
  hi: 'Hindi',
  en: 'English',
}

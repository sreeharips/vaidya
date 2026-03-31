# CLAUDE.md — Vaidya Project Intelligence

## What we are building

**Vaidya** — AI-powered marketplace for authentic Ayurveda retreats in Kerala.
Core: credentialing system, AI Prakriti (body-constitution) matching, booking + post-retreat medicine platform.
**Pitch:** "Zocdoc + Booking.com for authentic Ayurveda — AI matching, multilingual voice, outcome data."

---

## MVP Scope (Months 1–5) — build only these

- Search & discovery (clinic/doctor/condition-based)
- Prakriti assessment engine (rule-based, no LLM)
- Voice Prakriti assessment (STT → intent matcher → TTS)
- Clinic + doctor profiles and credentialing
- Booking flow + payment
- Doctor/clinic admin portal

**Defer:** medicine e-commerce, concierge/visa, ML matcher, outcomes intelligence, mobile app.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind, next-intl (EN/AR/DE/FR/ML/HI) |
| Backend | FastAPI (Python 3.12), async SQLAlchemy + asyncpg |
| DB | PostgreSQL 16 + pgvector (Supabase preferred) |
| Cache | Redis (sessions, voice context, matching results) |
| Payments | Stripe Connect (international) + Razorpay (India) |
| Infra | AWS — Mumbai, Frankfurt, Bahrain |

---

## Voice AI Stack — DO NOT CHANGE without discussion

| Component | Primary | Fallback |
|-----------|---------|---------|
| STT Arabic/Gulf | Deepgram Nova-3 Arabic | Azure Speech (ar-AE) |
| STT European | Azure Speech | Speechmatics |
| STT Malayalam/Hindi | Azure Speech | Google Speech |
| TTS EN/AR Premium | ElevenLabs Flash v2.5 | Cartesia Sonic-3 |
| TTS European | Inworld TTS-1.5 Max | Azure Neural TTS |
| Intent extraction | Custom keyword matcher | Claude Haiku (<15% ambiguous only) |

**Critical:** Deepgram has NO Arabic TTS. Never use it for TTS on Arabic sessions.

---

## Prakriti Engine — NO LLM

Pure Python weighted matrix. 22 questions × category weights → vata/pitta/kapha percentages.
Category weights: physical 1.4, digestion 1.2, mind 1.1, lifestyle 1.0.
**Always store raw answers AND computed scores** — raw answers are ML training data for Year 2.

---

## Database — Key Tables

```
patient_profiles     pseudo_id, prakriti_raw (JSONB), prakriti_scores, dosha_type, language
clinic_feature_store id, slug, name, tier, district, lat/lng, specialisations[], photos[], certifications[]
retreats             id, clinic_id, name, package_type, price_usd, duration_min/max_days, photos[]
bookings             id, patient_pseudo_id, clinic_id, retreat_id, guest_email, guest_name, dates, status, total_amount
users                id, email, full_name, role, clinic_id (FK for clinic_admin users)
clinic_team          id, clinic_id, name, role, title, photo_url
retreat_availability id, retreat_id, date, available_spots, is_blocked
outcomes_log         APPEND-ONLY — event_type, patient_pseudo_id, clinic_id, scores (JSONB)
reviews              id, patient_pseudo_id, clinic_id, booking_id, rating, review_text, verified
voice_sessions       session_id, language, stt_provider, intent_matches, confidence_scores
```

**outcomes_log is append-only. Never UPDATE or DELETE rows.**

---

## Auth Architecture

- Access token stored **in-memory** in AuthContext ref (`accessTokenRef`). Never in localStorage.
- Refresh token in localStorage (`vaidya_refresh_token`).
- Components needing auth must call `getAccessToken()` from `useAuth()` — never read localStorage for the Bearer token.
- Bookings link to users via `guest_email = user.email`. Booking forms must **pre-fill and lock** `guest_email` from the authenticated user so booking history queries work correctly.
- Admin auth: `get_admin_clinic()` resolves clinic via `admin_user_id` or `user.clinic_id`.
- Guest sessions: all activity tables have nullable `user_id` + nullable `session_id`. Never make `user_id` NOT NULL on activity tables.

---

## Search & Discovery

Three modes:
1. **Directed** — PostgreSQL `tsvector` FTS over doctor/clinic/treatment names
2. **Condition-based** — static YAML (`config/conditions.yaml`): condition → treatment_ids → clinic_ids. No LLM.
3. **Browse + filter** — faceted (treatment, budget, tier, district, language, prakriti, rating)

Assessment is optional — enhances search ranking, does not gate it.

---

## Key Decisions — Do Not Relitigate

1. No LLM in Prakriti scoring — weighted rule matrix only
2. No LLM in voice intent — keyword synonym dict; Haiku only for <15% ambiguous
3. No LLM in condition search — static YAML, mapped by BAMS doctor
4. Split STT/TTS providers — Deepgram Arabic STT, ElevenLabs/Inworld TTS
5. Store raw assessment answers, not just scores
6. Two-tier credentialing — quality is the moat
7. Booking is the acquisition channel — real LTV is medicine reorders
8. Voice assessment priced at $9 Premium / $29 Elite
9. Outcomes schema from day 1 — log everything from first booking
10. Search is browse-first — assessment enhances, never gates

---

## Before Starting Any Feature

1. Is this MVP scope? If not, defer.
2. Does it touch outcomes_log? Ensure events are logged.
3. Does it involve voice? Check STT/TTS routing table above.
4. Does it store patient data? Check pseudonymisation + GDPR.
5. Does it change Prakriti scoring? Medical Advisor sign-off required.

---

## Target Users

- Gulf NRI diaspora (UAE, Qatar, Kuwait) — Malayali origin, Arabic/Malayalam/English
- European wellness tourists (UK, DE, NL) — high-value, chronic condition focus

**North star metric:** Post-retreat medicine reorder rate (target >55% by Month 12)

---

*Last updated: March 2026 | MVP v1.0*

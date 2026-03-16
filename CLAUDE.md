# CLAUDE.md — Vaidya Project Intelligence

> This file is read by Claude Code at the start of every session.
> It gives Claude full context on the product, architecture, and decisions made — so you never have to re-explain.

---

## What we are building

**Vaidya** — an AI-powered marketplace and trust layer for authentic Ayurveda retreats in Kerala, India.

Not a generic wellness directory. The core product is:
1. A credentialing system that distinguishes real vaidyas from tourist spas
2. An AI Prakriti (body-constitution) engine that personalises clinic matching
3. A voice assessment layer (multilingual, no LLM on the hot path)
4. A booking + post-retreat medicine platform

**The one-line pitch:** "Zocdoc + Booking.com for authentic Ayurveda — with AI matching, multilingual voice, and outcome data."

---

## Current build phase

**MVP — Phase 1 (Months 1–5)**

Focus only on:
- **Search & discovery** — doctor search, hospital/clinic search, condition-based search, map view, filters (added March 2026)
- Prakriti assessment engine (no-LLM, rule-based)
- Voice Prakriti assessment (STT → intent matcher → TTS)
- Clinic discovery + credentialed profiles
- Doctor profile pages (separate entity from clinic)
- AI clinic matcher (rule-based, not ML yet)
- Treatment explainer (RAG over curated KB)
- Booking flow + payment
- Doctor/clinic admin portal (basic)

Do NOT build yet: medicine e-commerce, concierge/visa service, ML-based matcher, outcomes intelligence, mobile app.

---

## Tech stack (decided)

### Frontend
- **Framework:** Next.js 14 (App Router, SSR for SEO)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Localisation:** next-intl (6 languages: EN, AR, DE, FR, ML, HI)
- **Voice UI:** Web Audio API + WebSocket streaming to STT

### Backend
- **Framework:** FastAPI (Python 3.12)
- **Prakriti scoring:** Pure Python function — NO ML, NO LLM — deterministic weighted rules
- **Clinic matching:** Weighted heuristics in Python + pgvector for semantic fallback
- **Treatment explainer:** RAG pipeline (LangChain) over pgvector or Pinecone
- **Voice orchestration:** WebSocket server — STT stream → keyword intent matcher → TTS

### Database
- **Primary:** PostgreSQL 16 + pgvector extension (Supabase preferred for speed)
- **Outcomes log:** Append-only S3 (Parquet format, future Redshift compatible)
- **Cache:** Redis (session state, voice session context, matching results)

### Infrastructure
- **Cloud:** AWS
- **Regions:** Mumbai (India), Frankfurt (EU), Bahrain (Gulf) — for voice latency
- **Payments:** Stripe Connect (international) + Razorpay (India domestic)
- **Monitoring:** Datadog APM + Sentry

---

## Voice AI stack (critical — do not change without discussion)

| Component | Primary | Fallback |
|-----------|---------|---------|
| STT — Arabic/Gulf | Deepgram Nova-3 Arabic | Azure Speech (ar-AE, ar-EG) |
| STT — European langs | Azure Speech (54 locales) | Speechmatics |
| STT — Malayalam/Hindi | Azure Speech | Google Speech |
| TTS — EN/AR (Premium) | ElevenLabs Flash v2.5 | Cartesia Sonic-3 |
| TTS — European | Inworld TTS-1.5 Max | Azure Neural TTS |
| Intent extraction | Custom keyword matcher (Python) | Claude Haiku (ambiguous only, <15% of answers) |

**Critical constraint:** Deepgram has NO Arabic TTS — English-only. Never use Deepgram for TTS on Arabic sessions.

**Why keyword matching, not LLM:** The question set is closed (22 questions, 3 options each). Keyword + synonym dictionary covers 90%+ of responses at zero inference cost and <50ms latency. Only call Claude Haiku when confidence score is below threshold.

---

## Prakriti engine — how it works (NO LLM)

The scoring engine is a weighted matrix. Do not over-engineer this.

```python
# Each question answer returns dosha scores
# Example: "Thin, light, hard to gain weight" → {vata: 3, pitta: 1, kapha: 0}

CATEGORY_WEIGHTS = {
    "physical": 1.4,
    "digestion": 1.2,
    "mind": 1.1,
    "lifestyle": 1.0
}

def score(answers: list[Answer]) -> PrakrutiProfile:
    v, p, k = 0, 0, 0
    for answer in answers:
        w = CATEGORY_WEIGHTS[answer.category]
        v += answer.vata_score * w
        p += answer.pitta_score * w
        k += answer.kapha_score * w
    total = v + p + k or 1
    return PrakrutiProfile(
        vata=round(v / total * 100),
        pitta=round(p / total * 100),
        kapha=round(k / total * 100)
    )
```

**Store both raw answers AND computed scores.** Raw answers are the ML training data for Year 2. You cannot reconstruct them later.

---

## Voice pricing tiers

| Tier | Price | Stack | Gross margin |
|------|-------|-------|-------------|
| Standard | Free | Text form only | N/A |
| Premium | $9 | Deepgram STT + ElevenLabs TTS | ~94% |
| Elite | $29 | Premium + cloned vaidya voice + doctor review + PDF report | ~90% |

Cost per Premium assessment: ~$0.50 (Deepgram $0.043 + ElevenLabs $0.41 + infra $0.05)

---

## Clinic credentialing tiers

**Tier 1 — Verified:**
- BAMS/MD license check (Kerala State Medical Council API)
- AYUSH state registration
- Physical clinic inspection (40-point rubric)
- Doctor interview + specialisation mapping
- 3 patient references

**Tier 2 — Certified Authentic:**
- All Tier 1 requirements
- 5+ years + 50 documented cases
- Outcome data enrollment (required — feeds AI flywheel)
- Annual re-certification + mystery patient audit
- GMP-certified medicine sourcing

No clinic appears on the platform without completing Tier 1.

---

## Data schema — design on day 1

These tables must exist from the first commit, even if not all are used immediately:

```
patient_profiles        — id (pseudonym), prakriti_raw, prakriti_scores, dosha_type, language, created_at
doctors                 — id, slug, name, qualification, years_exp, clinic_id, specialisations[], prakriti_affinities[], languages[], bio, photo_url, tier, is_active
clinic_feature_store    — id, slug, name, tier, district, lat, lng, specialisations[], prakriti_affinities[], languages[], pricing_min, pricing_max, photos[], certifications[], outcome_enrolled
treatments              — id, name, slug, description, prakriti_tags[], duration_days[], price_range, doctor_ids[]
conditions_map          — condition_slug, condition_name, treatment_ids[], language (from conditions.yaml — seed data only)
treatment_kb            — id, name, description, prakriti_tags[], doctor_id, language, source_type
outcomes_log            — event_type, patient_pseudo_id, clinic_id, doctor_id, answers_raw (JSONB), scores, booking_status, medicine_ordered (APPEND ONLY)
bookings                — patient_id, clinic_id, doctor_id, treatment_id, dates, status, payment_ref, commission_amount
voice_sessions          — session_id, language, stt_provider, intent_matches, confidence_scores, reask_count, final_answers
reviews                 — id, patient_pseudo_id, clinic_id, doctor_id, booking_id, rating, text, verified, created_at
search_events           — query, type, results_count, clicked_id, clicked_type, patient_pseudo_id, lang (analytics)
```

**The outcomes_log is append-only. Never update or delete rows. It is the AI training corpus.**

**Full-text search:** Add `tsvector` columns to `doctors` and `clinic_feature_store` for PostgreSQL FTS. Index on `name`, `specialisations`, `bio`. Upgrade to Typesense if needed at scale.

---

## Search & discovery — critical feature (added March 2026)

This was identified as a gap in the original PRD. Search is an MVP feature, not deferred.

### The UX problem it fixes

The original design assumed all users take the Prakriti assessment before seeing clinics. That is wrong. Three user types exist and all must be served:

| User type | Entry point | What they need |
|-----------|-------------|----------------|
| Directed | Knows a doctor/clinic name | Search by name → land on profile → book |
| Condition-led | Has a health problem, not a treatment name | "back pain Kerala" → condition → matched treatments → clinics |
| Explorer | Browsing with no specific target | Filter by location / budget / tier / specialisation |

**The Prakriti assessment is the "get personalised matches" overlay, not the mandatory gate before seeing any clinics.**

---

### Three search modes to build

**1. Directed search** — full-text search over doctor names, clinic names, treatment names
- Powered by PostgreSQL `tsvector` full-text search (no external search engine at MVP)
- Upgrade to Typesense or Algolia if query volume exceeds 10K/day

**2. Condition-based search** — maps plain-language health conditions to treatments
- Static YAML lookup table: `condition → [treatment_ids]` → `treatment → [doctor/clinic_ids]`
- No LLM. A BAMS doctor maps conditions once. Examples:
  - "back pain" → Kati Basti, Abhyanga, Pizhichil
  - "stress / anxiety" → Shirodhara, Nasya, Abhyanga
  - "diabetes" → Panchakarma, Virechana, Udwarthanam
  - "arthritis" → Janu Basti, Pizhichil, Kizhi
  - "skin conditions" → Takradhara, Lepa, Njavara Kizhi
  - "digestive issues" → Basti, Virechana, Deepana
  - "weight management" → Udvartana, Panchakarma
  - "fertility" → Uttara Basti, Rasayana
- File: `config/conditions.yaml`

**3. Browse + filter** — faceted filtering over the clinic/doctor index
- Filters: treatment type, duration, budget, tier, location/district, doctor language, Prakriti affinity, availability, rating, doctor gender preference

---

### Two searchable entity types — both are MVP

**Doctor profile page** (`/[lang]/doctors/[slug]`)
- Photo, name, qualification (BAMS/MD), years experience
- Specialisations, languages spoken
- Credentialing tier badge (Tier 1 / Tier 2)
- Treatment list with price ranges
- Prakriti affinities (which dosha types they specialise in)
- Patient reviews (verified bookings only — no gaming)
- Next available slot + Book now CTA
- Linked to their clinic profile

**Hospital / clinic page** (`/[lang]/clinics/[slug]`)
- Photos, name, location + embedded map
- Tier badge (Verified / Certified Authentic)
- Doctors at this clinic (linked to doctor profiles)
- Treatment programmes with duration + price
- Accommodation type + photos
- Certifications (AYUSH, NABH, GMP)
- Reviews + Book now CTA

---

### Search API endpoints to build

```
GET /api/search?q=&type=all|doctor|clinic&lang=en
GET /api/search/condition?q=back+pain&lang=en
GET /api/clinics?tier=&treatment=&budget_min=&budget_max=&district=&language=&prakriti=&rating=
GET /api/doctors?specialisation=&language=&prakriti=&clinic_id=
GET /api/clinics/[id]
GET /api/doctors/[id]
```

---

### SEO strategy for search (critical for organic growth)

Every doctor and clinic gets a statically generated page (Next.js SSG):
- `/en/doctors/dr-krishnan-thrissur-ayurveda`
- `/en/clinics/somatheeram-ayurveda-village-kerala`
- `/en/treatments/panchakarma-kerala`
- `/en/conditions/back-pain-ayurveda-treatment`

Condition + location pages are pure SEO gold. "back pain Ayurveda treatment Kerala" is how international patients actually search. These pages are generated from `conditions.yaml` + clinic data. No content team needed.

---

### How search and Prakriti assessment connect

Search results always show a persistent nudge: **"Get personalised matches — take the Prakriti assessment"**

After assessment:
- Search results re-rank with Prakriti match score overlaid
- Each result shows "X% match for your Vata constitution"
- Filters auto-populate with Prakriti-compatible treatments

The assessment enhances search — it does not replace it.

---

## Key product decisions (already made — do not relitigate)

1. **No LLM in Prakriti scoring** — rule-based weighted matrix. Fast, cheap, explainable.
2. **No LLM in voice intent extraction** — keyword synonym dictionary. LLM only for <15% ambiguous answers.
3. **No LLM in condition search** — static YAML lookup table. A BAMS doctor maps conditions to treatments once.
4. **Split STT and TTS providers** — Deepgram for Arabic STT, ElevenLabs/Inworld for TTS. No single vendor.
5. **Store raw assessment answers** — not just computed scores. Critical for future ML.
6. **Two-tier credentialing** — quality is the moat. Do not lower the bar to onboard more clinics faster.
7. **Booking is the user acquisition channel** — the real LTV is medicine reorders. Design every flow to set this up.
8. **Voice assessment priced at $9 (Premium) / $29 (Elite)** — not free. Paid friction qualifies intent.
9. **Outcomes schema designed day 1** — even if the data product is Phase 3. Log everything from the first booking.
10. **Search is browse-first, assessment is optional** — Prakriti assessment enhances search results, it does not gate them. Users can find, browse and book without ever taking the assessment.

---

## Competitor context

| Platform | What they do | Why we beat them |
|----------|-------------|-----------------|
| BookRetreats.com | Generic wellness marketplace | No credentialing, no AI matching, no clinical depth |
| Retreat.guru | Spiritual retreat directory | Not Ayurveda-specific, no logistics |
| Ayurooms.com | Curated Kerala resorts | No AI, no visa/logistics, no medicine, small scale |
| CompareRetreats.com | Price comparison | Zero supply-side quality signal |
| NirogStreet | Doctor-facing Ayurveda | No patient marketplace, no international |

---

## Target users

**Primary patients:**
- Gulf NRI diaspora (UAE, Qatar, Kuwait) — Malayali origin, Arabic + Malayalam + English
- European wellness tourists (UK, Germany, Netherlands) — high-value, chronic condition focus

**Supply side:**
- BAMS/MD Ayurvedic doctors + clinics in Kerala
- Institutional anchors: Arya Vaidya Sala (Kottakkal), Vaidyaratnam, Somatheeram

---

## Revenue model (quick reference)

1. Retreat booking commission — 12–15% international, 6–8% domestic
2. Voice assessment — Free / $9 Premium / $29 Elite
3. Medicine e-commerce — 45–55% margin (Phase 2)
4. Concierge + visa — $150–300 flat fee (Phase 2)
5. Clinic SaaS — Free (Tier 1) / Rs 2–5K/mo (Tier 2) (Phase 2)
6. Outcomes data licensing — B2B, Phase 3

**North star metric:** Post-retreat medicine reorder rate (target: >55% by Month 12)

---

## Business metrics targets

| Metric | Month 9 (MVP) | Month 24 (Series A) |
|--------|--------------|-------------------|
| Credentialed clinics | 50 (15 Tier 2) | 200 (60 Tier 2) |
| International bookings | 200–400 | 5,000+ |
| Platform revenue | $60–150K | $3–5M ARR |
| LTV/CAC ratio | Baseline | 5x+ |

---

## What to ask before starting any feature

1. Is this MVP scope? If not, defer.
2. Does it touch the outcomes log? If yes, make sure events are logged.
3. Does it involve language/voice? Check the STT/TTS routing table above.
4. Does it store patient data? Check pseudonymisation and GDPR rules.
5. Does it change the Prakriti scoring logic? Medical Advisor must sign off.

---

## Folder structure (suggested)

```
vaidya/
├── frontend/               # Next.js 14 app
│   ├── app/
│   │   ├── [lang]/         # Localised routes (en, ar, de, fr, ml, hi)
│   │   │   ├── page.tsx          # Homepage with search bar
│   │   │   ├── search/           # Search results page
│   │   │   ├── doctors/          # Doctor listing + [slug] profile pages
│   │   │   ├── clinics/          # Clinic listing + [slug] profile pages
│   │   │   ├── treatments/       # Treatment pages (SEO)
│   │   │   ├── conditions/       # Condition pages (SEO) e.g. /en/conditions/back-pain
│   │   │   ├── assessment/       # Prakriti assessment flow
│   │   │   └── booking/          # Booking flow
│   │   └── admin/          # Doctor portal (no lang prefix)
│   ├── components/
│   │   ├── search/         # SearchBar, SearchResults, FilterPanel, MapView
│   │   ├── cards/          # DoctorCard, ClinicCard, TreatmentCard
│   │   └── assessment/     # PrakrutiForm, VoiceAssessment, ResultDisplay
│   └── messages/           # i18n strings (en.json, ar.json, ...)
├── backend/                # FastAPI app
│   ├── api/
│   │   ├── search.py       # GET /search, /search/condition — full-text + condition search
│   │   ├── doctors.py      # GET /doctors, /doctors/[id]
│   │   ├── clinics.py      # GET /clinics, /clinics/[id]
│   │   ├── assessment.py   # Prakriti scoring endpoints
│   │   ├── matching.py     # Prakriti-to-clinic matching (post-assessment)
│   │   ├── voice.py        # WebSocket voice session handler
│   │   ├── booking.py      # Booking + payment endpoints
│   │   └── explainer.py    # Treatment explainer RAG
│   ├── core/
│   │   ├── prakriti.py     # Scoring engine (pure Python, no deps)
│   │   ├── intent.py       # Keyword intent matcher
│   │   ├── search.py       # Full-text search + condition lookup logic
│   │   └── config.py       # Question + weight config (YAML)
│   └── db/
│       ├── models.py       # SQLAlchemy models (all tables)
│       └── outcomes.py     # Append-only outcomes log writer
├── config/
│   ├── questions.yaml      # 22 questions + answer weights
│   ├── synonyms.yaml       # Intent matching synonym lists per question
│   ├── tendencies.yaml     # Dosha type → health tendencies lookup
│   └── conditions.yaml     # Condition → treatment mapping (SEO + search)
├── scripts/
│   └── seed_conditions.py  # Seed conditions_map table from conditions.yaml
├── CLAUDE.md               # This file
└── memory.md               # Session memory for Claude Code
```

---

## Environment variables needed

```bash
# Database
DATABASE_URL=
REDIS_URL=

# Voice — STT
DEEPGRAM_API_KEY=          # Arabic STT
AZURE_SPEECH_KEY=          # EU + ML + HI STT
AZURE_SPEECH_REGION=

# Voice — TTS
ELEVENLABS_API_KEY=        # EN/AR TTS (Premium)
INWORLD_API_KEY=           # EU TTS

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# AI (used sparingly — only for ambiguous voice intent)
ANTHROPIC_API_KEY=         # Claude Haiku for <15% ambiguous answers

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=             # Outcomes log

# App
NEXT_PUBLIC_APP_URL=
```

---

*Last updated: March 2026 | Product: Vaidya MVP v1.0 | Search & discovery feature added*

# memory.md — Vaidya Project Running Memory

> Claude Code updates this file after each meaningful session.
> It tracks what has been built, what decisions were made, and what to pick up next.
> Always read this at the start of a session before touching any code.

---

## Project status

**Current phase:** Pre-build — architecture decided, no code written yet  
**Last updated:** March 2026  
**Active sprint:** Foundation setup (Month 1)

---

## What has been decided (do not re-decide these)

### Product
- Product name: **Vaidya**
- MVP scope locked: **Search & discovery (doctor + clinic + condition search)** + Prakriti engine + Voice assessment + Clinic discovery + Doctor profiles + Clinic matcher + Treatment explainer + Booking flow + Admin portal
- Phase 2 (deferred): Medicine e-commerce, Concierge/visa, Doctor content co-pilot, Protocol tracker
- Phase 3 (deferred): Outcomes intelligence, B2B data licensing, Vision/tongue diagnostics

### Architecture
- Frontend: Next.js 14 + TypeScript + Tailwind + next-intl
- Backend: FastAPI (Python 3.12)
- DB: PostgreSQL 16 + pgvector (Supabase)
- Cache: Redis
- Outcomes log: Append-only S3 (Parquet)
- Payments: Stripe Connect (international) + Razorpay (India)

### Voice AI
- Arabic STT: Deepgram Nova-3 Arabic (NOT Deepgram TTS — they have no Arabic TTS)
- EU STT: Azure Speech
- EN/AR TTS: ElevenLabs Flash v2.5
- EU TTS: Inworld TTS-1.5 Max
- Intent extraction: Python keyword matcher (no LLM on hot path)
- LLM fallback: Claude Haiku — only when voice intent confidence < threshold (~15% of answers)

### Pricing
- Standard: Free (text form)
- Premium voice: $9 (Deepgram + ElevenLabs, multilingual)
- Elite voice: $29 (cloned vaidya voice + async doctor review + PDF report)
- Cost per Premium session: ~$0.50 → 94% gross margin
- Cost per Elite session: ~$2.80 → 90% gross margin

### Prakriti engine
- 22 questions across 4 categories: physical (8), digestion (5), mind (5), lifestyle (4)
- Category weights: physical 1.4, digestion 1.2, mind 1.1, lifestyle 1.0
- Output: Vata %, Pitta %, Kapha % + primary/secondary type + treatment affinities
- No ML, no LLM — pure Python weighted scoring
- Raw answers stored separately from computed scores (for future ML training)

### Search & discovery (added March 2026 — MVP scope)
- **Prakriti assessment is NOT a gate** — users can search, browse, and book without taking it
- **Three search modes:** directed (name search), condition-based ("back pain"), browse + filter
- **Two entity types:** doctor profile pages + clinic/hospital pages — both separately searchable
- **Condition mapping:** static YAML config (`conditions.yaml`) — no LLM, BAMS doctor fills once
- **Full-text search:** PostgreSQL `tsvector` at MVP; Typesense if volume exceeds 10K queries/day
- **SEO pages:** statically generated pages for every doctor, clinic, treatment, condition + location combo
- **Assessment overlay:** post-assessment, search results gain Prakriti match scores — enhances, not replaces

### Clinic credentialing
- Tier 1 (Verified): BAMS license + AYUSH registration + physical inspection + interview + 3 references
- Tier 2 (Certified Authentic): All Tier 1 + 5yr+ + 50 cases + outcome data enrollment + annual audit
- Target: 50 clinics at MVP launch (15 Tier 2)

---

## What has been built

Nothing yet — project in planning phase.

### Completed
- [ ] Repo initialised
- [ ] Next.js app bootstrapped
- [ ] FastAPI app bootstrapped
- [ ] Database schema created (all tables incl. doctors, search_events, conditions_map)
- [ ] conditions.yaml written (condition → treatment mapping)
- [ ] questions.yaml written (22 questions with weights)
- [ ] synonyms.yaml written (intent matching)
- [ ] tendencies.yaml written (dosha type → health tendencies)
- [ ] Prakriti scoring engine (prakriti.py)
- [ ] Search API (search.py — full-text + condition-based)
- [ ] Doctor API (doctors.py — list + profile)
- [ ] Clinic API (clinics.py — list + profile)
- [ ] Doctor profile pages (frontend /[lang]/doctors/[slug])
- [ ] Clinic profile pages (frontend /[lang]/clinics/[slug])
- [ ] Condition SEO pages (frontend /[lang]/conditions/[slug])
- [ ] Search results page with filters (frontend /[lang]/search)
- [ ] Map view component (clinic locations, Kerala)
- [ ] Voice WebSocket handler
- [ ] STT routing logic
- [ ] TTS routing logic
- [ ] Clinic matching algorithm (post-assessment Prakriti overlay)
- [ ] Treatment explainer RAG
- [ ] Booking flow
- [ ] Payment integration (Stripe)
- [ ] Admin portal
- [ ] Localisation (6 languages)

---

## Current session — what to work on next

### Immediate next steps (do in order)

1. **Bootstrap the repo**
   ```bash
   # Frontend
   npx create-next-app@latest frontend --typescript --tailwind --app
   cd frontend && npm install next-intl

   # Backend
   mkdir backend && cd backend
   python3 -m venv venv && source venv/bin/activate
   pip install fastapi uvicorn sqlalchemy asyncpg redis python-dotenv pydantic
   pip install langchain anthropic deepgram-sdk azure-cognitiveservices-speech elevenlabs boto3
   ```

2. **Write conditions.yaml first** — the condition → treatment mapping that powers condition-based search AND SEO pages. A BAMS doctor must review this before it goes live. Start with 15–20 common conditions (back pain, stress, diabetes, arthritis, skin, digestion, weight, fertility, insomnia, sinusitis).

3. **Write the full database schema** (`backend/db/models.py`)
   Priority order: `outcomes_log` → `doctors` → `clinic_feature_store` → `treatments` → `conditions_map` → `bookings` → `voice_sessions` → `search_events`
   The outcomes_log must be append-only from day 1.
   Add `tsvector` columns to `doctors` and `clinic_feature_store` for PostgreSQL FTS.

4. **Build search API** (`backend/api/search.py`) — this is the most SEO-critical feature
   - `GET /api/search?q=&type=all|doctor|clinic&lang=en` — full-text over doctors + clinics
   - `GET /api/search/condition?q=back+pain&lang=en` — lookup conditions.yaml → return matched clinics/doctors

5. **Build doctor + clinic APIs** (`backend/api/doctors.py`, `backend/api/clinics.py`)
   - List endpoints with filters (tier, specialisation, language, prakriti, district, budget)
   - Single profile endpoints by slug

6. **Build frontend search + profile pages**
   - Search results page with filter panel + map toggle
   - Doctor profile page (`/[lang]/doctors/[slug]`)
   - Clinic profile page (`/[lang]/clinics/[slug]`)
   - Condition SEO pages (`/[lang]/conditions/[slug]`) — statically generated

7. **Write questions.yaml** — 22-question Prakriti config with per-answer dosha scores

8. **Write the Prakriti scoring engine** (`backend/core/prakriti.py`) — pure Python, zero ML deps

9. **Write synonyms.yaml + intent matcher** — for voice assessment

10. **Set up voice WebSocket handler** (`backend/api/voice.py`)

---

## Open questions (unresolved)

- [ ] **Medicine export regulatory:** Which markets (UAE, UK, DE) permit Ayurvedic formulation import? Need legal review before Phase 2.
- [ ] **BAMS Medical Advisor hire:** Target profile and equity range? Blocks clinic onboarding.
- [ ] **Voice persona for Elite tier:** Clone a real named vaidya's voice OR synthetic persona? Legal risk trade-off.
- [ ] **ElevenLabs vs Inworld at launch:** Split stack (ElevenLabs for AR/EN, Inworld for EU) OR single vendor (ElevenLabs only) at MVP? Ops simplicity vs cost.
- [ ] **Clinic admin UX:** Web portal vs WhatsApp-integrated workflow for traditional vaidyas?
- [ ] **Cancellation policy:** Who absorbs cost — platform, clinic, or patient?
- [ ] **Prakriti disclaimer language:** Legal review per market before first patient-facing launch.

---

## Key people / context

- **Co-founder reference shared:** Pratheesh Anish
- **Competitor sites reviewed:** bookretreats.com, retreat.guru, tripaneer.com, ayurooms.com, compareretreats.com
- **Target VC list:** Jungle Ventures (highest conviction — backed NirogStreet + TAE), Fireside Ventures, Nexus Venture Partners, Accel India, Kerala Startup Mission (KSIDC)
- **Institutional clinic anchors to approach:** Arya Vaidya Sala (Kottakkal), Vaidyaratnam, Somatheeram Ayurveda Village, AVS Hospital

---

## Important constraints — always respect these

1. **Never use an LLM for Prakriti scoring** — deterministic rules only. Medical integrity.
2. **Never use an LLM for condition search** — static YAML lookup. A BAMS doctor maps it once.
3. **Never use Deepgram for TTS** — they have no Arabic TTS. Always split STT and TTS providers.
4. **Always log raw assessment answers** — not just computed scores. The raw data is the ML training corpus.
5. **Outcomes log is append-only** — no UPDATE or DELETE on this table, ever.
6. **No clinic goes live without Tier 1 completion** — quality is the product's entire moat.
7. **GDPR compliance** — PII stored separately from health data. Patient IDs pseudonymised in outcomes log.
8. **No diagnostic language** — the treatment explainer and voice agent are educators, not doctors.
9. **Search does not require assessment** — users must be able to find, browse, and book without taking Prakriti assessment. Assessment is an enhancement overlay, not a gate.

---

## Useful reference numbers

| Thing | Number |
|-------|--------|
| Target clinics at MVP launch | 50 (15 Tier 2) |
| Assessment questions | 22 (across 4 categories) |
| Voice languages at MVP | 6 (EN, AR, DE, FR, ML, HI) |
| Premium voice price | $9 |
| Elite voice price | $29 |
| Cost per Premium session | ~$0.50 |
| Target gross margin (Premium voice) | 94% |
| Target booking commission (international) | 12–15% |
| Target booking commission (domestic) | 6–8% |
| Target LTV/CAC (Series A) | 5x+ |
| Target medicine reorder rate (Month 12) | >55% |
| Deepgram cost per minute | $0.0043 |
| ElevenLabs cost per 1M chars | $206 |
| Inworld TTS cost per 1M chars | $10 |

---

## Session log

### Session 1 — March 2026
- Full product strategy developed (market, VC landscape, revenue model, unit economics)
- AI architecture decided (3 Phase 1 systems: Prakriti engine, clinic matcher, treatment explainer)
- No-LLM Prakriti architecture designed (4-layer: intake → scoring matrix → profile builder → outputs)
- Voice AI architecture designed (STT → intent matcher → scoring → TTS)
- Voice pricing model finalised ($0 / $9 / $29 tiers, unit economics validated)
- Voice model comparison completed (STT + TTS for Middle East + European markets)
- PRD written and exported as vaidya_prd.docx (17 sections)
- CLAUDE.md and memory.md created — ready to start coding

### Session 2 — March 2026
- **Gap identified:** Search and discovery was missing from PRD and CLAUDE.md
- Search added to MVP scope — doctor search, clinic/hospital search, condition-based search, map view, filters
- Identified that Prakriti assessment must not gate discovery — browse-first UX required
- Three search modes defined: directed, condition-based, browse + filter
- Two searchable entity types confirmed: Doctor profile pages + Clinic/hospital pages (separate)
- Condition → treatment mapping approach decided: static YAML (conditions.yaml), no LLM
- SEO strategy defined: SSG pages for every doctor, clinic, treatment, condition + location
- Database schema updated: added `doctors`, `search_events`, `conditions_map`, `reviews` tables
- Folder structure updated with search routes and new config files
- CLAUDE.md and memory.md updated with all search decisions
- Next step: bootstrap repo, write conditions.yaml, build DB schema, build search API

### Session 3 — [date]
- [Update here after next session]

---

*Update this file at the end of every Claude Code session. Add to the session log. Update the "What has been built" checklist. Note any new decisions or resolved open questions.*

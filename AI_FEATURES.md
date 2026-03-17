# AI Features — Vaidya Platform

> Living document. Updated as capabilities are planned, built, or refined.
> Last updated: March 2026

---

## Core design principles

- **No LLM on the hot path for deterministic tasks** — Prakriti scoring, condition lookup, and voice intent matching all use rule-based engines. LLMs are called only where ambiguity requires reasoning.
- **Multilingual by architecture, not afterthought** — every AI feature routes through a language context so the same capability works in Arabic, Malayalam, Hindi, German, and English without forking code.
- **Log everything** — every AI interaction (voice session, intake extraction, translation event) writes to `outcomes_log`. This is the training corpus for Year 2.
- **Async over real-time where possible** — async consultation bridge delivers 80% of the value of real-time translation at 10% of the infrastructure complexity.

---

## The core multilingual problem

A Kerala vaidya speaks Malayalam. Their patient may be from Dubai (Arabic), Germany (German), Karnataka (Kannada/Hindi), or the UK (English). There is currently zero communication infrastructure between them after booking. Every feature below is ultimately solving some part of this gap.

---

## Feature map

### Phase 1 — MVP (build now)

---

### 1. Multilingual Voice Prakriti Assessment

**What it does**
Patient speaks their language. STT captures it. Keyword intent matcher maps the answer to one of the 22 questions × 3 options. TTS reads the next question in their language. No LLM on the hot path — keyword + synonym dictionary covers 90%+ of responses at <50ms latency.

**Why it matters**
A Gulf NRI answering health questions in Arabic is a fundamentally different — and far more comfortable — experience than filling a text form. This is the primary driver of Premium ($9) and Elite ($29) tier revenue.

**Stack**

| Component | Language group | Provider |
|-----------|---------------|----------|
| STT | Arabic (Gulf) | Deepgram Nova-3 Arabic |
| STT | European langs | Azure Speech (54 locales) |
| STT | Malayalam / Hindi | Azure Speech → Google Speech fallback |
| TTS | EN / AR | ElevenLabs Flash v2.5 |
| TTS | European | Inworld TTS-1.5 Max |
| Intent extraction | All | Custom keyword matcher (Python) |
| Ambiguous fallback | All | Claude Haiku (<15% of answers) |

**Critical constraint:** Deepgram has no Arabic TTS. Never route Arabic TTS through Deepgram.

**Config files**
- `config/questions.yaml` — 22 questions + answer weights (source of truth)
- `config/synonyms.yaml` — per-language keyword synonym dictionaries
- `backend/api/voice.py` — WebSocket handler
- `backend/core/intent.py` — keyword intent matcher

**Pricing tiers**

| Tier | Price | Stack | Gross margin |
|------|-------|-------|-------------|
| Standard | Free | Text form only | — |
| Premium | $9 | Deepgram STT + ElevenLabs TTS | ~94% |
| Elite | $29 | Premium + cloned vaidya voice + doctor review + PDF report | ~90% |

Cost per Premium assessment: ~$0.50 (Deepgram $0.043 + ElevenLabs $0.41 + infra $0.05)

**Status:** Backend stub exists (`voice.py`). WebSocket server + synonym dictionaries not yet built.

---

### 2. Treatment Explainer (RAG)

**What it does**
Patient or doctor asks a natural-language question about a treatment:
> *"What is Kati Basti? Is it safe if I have a herniated disc?"*

RAG pipeline retrieves relevant documents from the curated treatment KB (stored in pgvector), then Claude generates a grounded answer. No hallucination — every claim is sourced from the KB.

**Two faces:**
- **Patient-facing** — plain language, patient's preferred language, avoids clinical jargon
- **Doctor-facing** — full clinical terminology, Malayalam option, contraindication detail

**Stack**
- `backend/api/explainer.py` — FastAPI endpoint
- `backend/db/models.py` → `treatment_kb` table (pgvector embeddings)
- LangChain RAG pipeline → Claude Sonnet for generation
- Embedding model: `text-embedding-3-small` (OpenAI) or `claude` embeddings

**Status:** Endpoint stub exists. KB not yet seeded. RAG pipeline not yet wired.

---

### 3. AI Intake Form → Doctor Brief

**What it does**
When a patient books, they complete a health history form in their language (text or voice). Before the doctor's first consultation, the system generates a structured Malayalam brief:

> *"67-year-old German male. Chief complaint: chronic lower back pain (L4/L5, 3 years). Current medications: metformin 500mg (Type 2 diabetes). Contraindications: avoid prone position. Requested treatments: Kizhi, Pizhichil. Language: German."*

The doctor arrives prepared. The first 10 minutes are treatment, not history-taking.

**What Claude does**
- Extracts structured medical entities from free-text in any language
- Maps to Ayurvedic intake categories (chief complaint, digestion, sleep, medications, contraindications)
- Generates the Malayalam brief
- Flags anything that needs human review (drug interactions, serious conditions)

**Output**
- PDF brief delivered to doctor's tablet/print queue 1 hour before appointment
- Stored in `bookings` table as JSONB

**Status:** Not yet built. No backend endpoint. Design only.

---

### 4. Async Consultation Bridge

**What it does**
Solves the post-booking / pre-arrival communication gap without real-time infrastructure.

Flow:
1. Patient submits pre-consultation questions in their language (text or voice note)
2. Claude translates to Malayalam, presents to doctor as structured intake update
3. Doctor responds in Malayalam (typed or voice)
4. Claude translates back to patient's language, delivers via WhatsApp or email
5. Turnaround: 2–4 hours

This removes the single biggest drop-off point between booking confirmation and retreat arrival. International patients routinely abandon bookings because they can't communicate with the clinic after booking.

**Stack**
- New `consultation_messages` table (sender, language, content_original, content_translated, direction)
- Claude Sonnet for translation (medical context system prompt)
- WhatsApp Business API or email for delivery
- New backend endpoints: `POST /api/consultations/{booking_id}/message`

**Guardrails**
- Translation of dosage instructions or drug names is flagged for human review — never sent directly
- All original + translated messages stored; doctor can see both
- Patient sees a disclaimer: "Messages translated by AI. Ask your doctor to confirm critical instructions."

**Status:** Not yet built. Schema partially covered by `consultation_history` table.

---

### Phase 2

---

### 5. Post-Retreat Follow-up AI

**What it does**
After the patient leaves Kerala, the vaidya prescribes medicines + a lifestyle protocol (in Malayalam). The AI:

1. Translates the full protocol to the patient's language with cultural framing
2. Sends weekly check-in messages in the patient's language:
   > *"How is your digestion this week? Are you following the Vata-pacifying diet?"*
3. Patient replies → AI triages: routine update vs. needs doctor attention
4. Generates monthly summary for doctor: *"Patient reports improved sleep, digestion still irregular. Recommend follow-up."*

**Why it matters**
This is the mechanism that drives medicine reorders — the north star metric (target: >55% reorder rate by Month 12). Without follow-up, patients forget the protocol within 2 weeks.

**Stack**
- WhatsApp Business API for message delivery (highest open rate for Gulf + Indian patients)
- Claude Haiku for triage classification (cheap, fast)
- Claude Sonnet for protocol translation (quality matters here)
- `outcomes_log` — every follow-up interaction logged (append-only)

**Status:** Not yet built. Phase 2 scope.

---

### 6. Symptom-to-Treatment Mapper (AI upgrade of condition search)

**What it does**
Upgrades the static `conditions.yaml` YAML lookup with an AI layer for complex, multi-symptom queries:

> *"I've had joint pain in my knees for 3 years, worse in cold weather, and my digestion is very slow"*

- Claude extracts symptom entities and infers Ayurvedic interpretation (Ama accumulation, Vata aggravation in joints)
- Maps to treatment categories: Janu Basti, Panchakarma, Kizhi
- Recommends specific credentialed doctors whose specialisation matches the pattern
- Explains *why* each treatment is recommended in the patient's language

**When to use AI vs. YAML**
- Simple, single-condition queries (`"back pain"`) → YAML lookup (zero cost, instant)
- Complex, multi-symptom, or ambiguous queries → Claude Sonnet
- Router logic: if query matches a known condition slug exactly → YAML; else → AI

**Status:** Not yet built. Phase 2 scope.

---

### 7. Doctor Profile AI Writer

**What it does**
Each doctor fills in a simple onboarding form in Malayalam. AI generates:
- SEO-optimised English profile (for international patients and Google)
- Arabic version (Gulf NRI segment)
- German version (European wellness tourist segment)
- Structured specialisation tags extracted from free-text bio

Run once at onboarding. No content team needed. Every new doctor gets a fully localised profile in under 5 minutes.

**Status:** Not yet built. Phase 2 scope.

---

### 8. Review Intelligence

**What it does**
As reviews accumulate:
- **Anomaly detection** — flags suspicious reviews (sudden spike, too similar, no associated booking)
- **Sentiment summarisation** — *"Patients consistently praise Dr. Menon's Shirodhara but mention long waiting times"*
- **Cross-language consolidation** — German and Arabic reviews translated and aggregated with English ones so doctors see the full picture
- **Response drafting** — suggests a Malayalam clinic response to negative reviews

**Status:** Not yet built. Phase 2/3 scope.

---

### Phase 3

---

### 9. Real-time Consultation Interpreter

**What it does**
Doctor and patient on a video call. Live bidirectional voice translation:
- Doctor speaks Malayalam → patient hears English/Arabic/German via TTS voice
- Patient speaks their language → doctor sees Malayalam caption on screen

**Why this is Phase 3, not Phase 1**
ElevenLabs Flash v2.5 achieves ~800ms end-to-end latency — borderline acceptable for voice. The infrastructure (WebRTC + WebSocket + dual STT streams + TTS playback) is complex to operate reliably. The async consultation bridge (Feature 4) solves 80% of the same problem at 10% of the complexity. Build the bridge first, validate demand, then build this.

**Stack**
- WebRTC for video (Daily.co or Twilio Video)
- Deepgram streaming STT (Arabic) + Azure STT (other languages) — parallel streams
- Claude Haiku for real-time translation (latency-optimised)
- ElevenLabs Flash v2.5 for TTS output

---

### 10. Outcomes Intelligence (AI flywheel)

**What it does**
By Year 2, the `outcomes_log` table contains thousands of append-only records:
- Prakriti raw answers
- Treatments received
- Follow-up check-in responses
- Medicine reorder patterns
- Doctor ratings per treatment

The AI layer:
- Identifies which treatments work for which Prakriti + condition combinations
- Surfaces patterns doctors don't see across their individual patient base
- Powers a "treatment efficacy score" shown on clinic profiles
- Trains a personalised matching model (upgrades the current rule-based matcher)

**Why the outcomes_log is append-only:** This corpus is the entire moat. Once you have 10,000 treatment outcomes with Prakriti profiles, no competitor can replicate it without years of data collection. Every row logged now is a future competitive advantage.

**Status:** Schema designed from day 1. Data collection starts at first booking. AI layer is Phase 3.

---

## Language coverage

| Language | Patient segment | STT | TTS | Priority |
|----------|----------------|-----|-----|----------|
| Arabic (Gulf) | UAE/Qatar/Kuwait NRI diaspora | Deepgram Nova-3 | ElevenLabs Flash | P0 |
| English | International default | Azure | ElevenLabs Flash | P0 |
| Malayalam | Kerala diaspora + domestic | Azure | Azure Neural | P1 |
| Hindi | North India + NRI | Azure | Azure Neural | P1 |
| German | Germany/Austria/Switzerland | Azure | Inworld TTS-1.5 | P2 |
| French | France/Belgium/Morocco | Azure | Inworld TTS-1.5 | P2 |
| Kannada | Karnataka | Azure | Azure Neural | P3 |
| Tamil | Tamil Nadu + Sri Lanka | Azure | Azure Neural | P3 |

---

## What NOT to build with AI

| Temptation | Why not |
|-----------|---------|
| LLM for Prakriti scoring | Rule-based matrix is faster, cheaper, explainable, and auditable by medical advisors |
| LLM for condition → treatment lookup | Static YAML is instant and zero-cost for known conditions |
| Real-time translation at MVP | Async bridge solves 80% of the problem at 10% of the complexity |
| AI dosage instructions without human review | Medical liability. Always flag for doctor confirmation |
| ML-based clinic matching at MVP | Weighted heuristics + pgvector semantic fallback is sufficient until you have outcome data |

---

## Token cost estimates (monthly, at scale)

| Feature | Model | Est. calls/month | Cost/call | Monthly cost |
|---------|-------|-----------------|-----------|-------------|
| Voice intent fallback | Claude Haiku | 5,000 | $0.001 | $5 |
| Treatment explainer | Claude Sonnet | 2,000 | $0.015 | $30 |
| Intake → doctor brief | Claude Sonnet | 500 | $0.02 | $10 |
| Async bridge translation | Claude Sonnet | 3,000 | $0.01 | $30 |
| Post-retreat follow-up triage | Claude Haiku | 10,000 | $0.001 | $10 |
| **Total** | | | | **~$85/month** |

At MVP scale (500 bookings/month), AI costs are negligible. The $9 Premium assessment alone covers the entire AI bill at ~10 assessments/month.

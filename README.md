# Vaidya

**AI-powered marketplace and trust layer for authentic Ayurveda retreats in Kerala, India.**

> Zocdoc + Booking.com for authentic Ayurveda — with AI matching, multilingual voice, and outcome data.

---

## Quick start (Docker — recommended)

```bash
# 1. Copy env file and fill in your keys
cp .env.example .env.local

# 2. Start all services (Postgres, Redis, backend, frontend)
make up

# 3. Run database migrations
make migrate

# 4. Seed initial data
make seed
```

Services will be available at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **Postgres:** localhost:5432
- **Redis:** localhost:6379

---

## Local development (without Docker)

### Backend

Requires Python 3.12+.

```bash
cd backend

# Install uv (fast Python package manager)
pip install uv

# Create virtual environment
uv venv .venv

# Activate
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate    # Windows

# Install dependencies
uv pip install -r requirements.txt

# Copy env file
cp ../.env.example ../.env.local
# Edit .env.local — set DATABASE_URL, REDIS_URL, etc.

# Start dev server
uvicorn main:app --reload --port 8000
```

Backend available at: http://localhost:8000
API docs: http://localhost:8000/docs

### Frontend

Requires Node.js 20+.

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend available at: http://localhost:3000

---

## Project structure

```
vaidya/
├── frontend/               # Next.js 14 (App Router, TypeScript, Tailwind)
│   ├── app/
│   │   ├── [lang]/         # Localised routes (en, ar, de, fr, ml, hi)
│   │   │   ├── page.tsx
│   │   │   ├── search/
│   │   │   ├── doctors/[slug]/
│   │   │   ├── clinics/[slug]/
│   │   │   ├── treatments/[slug]/
│   │   │   ├── conditions/[slug]/
│   │   │   ├── assessment/
│   │   │   └── booking/
│   │   └── admin/
│   ├── components/
│   │   ├── search/         # SearchBar, SearchResults, FilterPanel, MapView
│   │   ├── cards/          # DoctorCard, ClinicCard, TreatmentCard
│   │   └── assessment/     # PrakrutiForm, VoiceAssessment, ResultDisplay
│   └── messages/           # i18n strings (en.json, ar.json, ...)
├── backend/                # FastAPI (Python 3.12)
│   ├── api/                # Route handlers
│   ├── core/               # Business logic (Prakriti engine, intent matcher)
│   ├── db/                 # SQLAlchemy models + outcomes writer
│   └── scripts/            # One-off scripts
├── config/
│   ├── questions.yaml      # 22 Prakriti assessment questions + weights
│   ├── synonyms.yaml       # Voice intent keyword matching
│   ├── tendencies.yaml     # Dosha → health tendencies lookup
│   └── conditions.yaml     # Condition → treatment mapping (search + SEO)
├── scripts/
│   └── seed_conditions.py  # Seed conditions_map from conditions.yaml
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

## Make commands

| Command | Action |
|---------|--------|
| `make up` | Build and start all Docker services |
| `make down` | Stop all services |
| `make logs` | Tail all service logs |
| `make db` | Open psql shell in postgres container |
| `make migrate` | Run Alembic migrations (`alembic upgrade head`) |
| `make seed` | Seed initial data |
| `make shell` | Bash shell in backend container |
| `make reset` | Destroy volumes and rebuild from scratch |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, next-intl |
| Backend | FastAPI, Python 3.12, uv |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| ORM | SQLAlchemy 2 (async) + Alembic |
| Payments | Stripe Connect + Razorpay |
| STT (Arabic) | Deepgram Nova-3 |
| STT (EU/ML/HI) | Azure Speech |
| TTS (EN/AR) | ElevenLabs Flash v2.5 |
| TTS (EU) | Inworld TTS-1.5 Max |
| Voice intent | Custom keyword matcher (Claude Haiku fallback <15%) |
| Prakriti engine | Pure Python weighted rules — NO ML/LLM |
| Infrastructure | AWS (Mumbai + Frankfurt + Bahrain) |

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

See `.env.example` for all required keys. Never commit `.env.local`.

---

## Languages supported

English (en), Arabic (ar), German (de), French (fr), Malayalam (ml), Hindi (hi)

---

## Key constraints

- **Prakriti scoring is never LLM-based** — deterministic weighted rules only
- **Condition search is never LLM-based** — static YAML lookup
- **Deepgram is STT-only** — never use for Arabic TTS (they have no Arabic TTS)
- **Outcomes log is append-only** — never UPDATE or DELETE rows
- **No clinic onboards without Tier 1 credentialing**
- **Assessment never gates search** — browse and book without Prakriti

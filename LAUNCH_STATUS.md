# Vaidya — Launch Readiness
*Last assessed: 2026-04-19 | Overall: ~65-70% complete*

---

## Critical Blockers — Cannot Take Real Bookings

| # | Gap | Where |
|---|-----|--------|
| 1 | **Payment is mock-only** | `backend/api/booking.py` — no Stripe session creation, no webhook verification, no Razorpay |
| 2 | **No email notifications** | No provider wired (SendGrid/Resend) — clinics never see new bookings, guests get no confirmation |

---

## High — Core MVP Features Missing

| # | Gap | Notes |
|---|-----|-------|
| 3 | **Prakriti assessment deleted** | Migration `k1l2m3n4o5p6` (2026-03-26) removed it entirely — `/[lang]/assessment` is empty, `PatientProfile` columns gone, no scoring logic, no `core/prakriti.py` |
| 4 | **`config/` directory empty** | `questions.yaml`, `conditions.yaml`, `synonyms.yaml` all missing — blocks prakriti + voice + condition search |
| 5 | **Production infra not set up** | AWS secrets, SSL, backups, error monitoring — nothing configured |

---

## Medium — Degrades Soft-Launch Experience

| # | Gap | Notes |
|---|-----|-------|
| 6 | Condition-based search | Needs `conditions.yaml` (condition → treatment → clinic mapping) |
| 7 | Voice assessment | Entirely unbuilt — no STT/TTS providers, no `/api/voice/*` endpoints, no `VoiceSession` model |
| 8 | "Mark as arrived/completed" in admin | API endpoint exists (`POST /api/admin/clinic/bookings/{id}/complete`), no UI button |
| 9 | Tier credentialing workflow | Hardcoded "Tier 1 Verified" in footer — no verification logic |
| 10 | Faceted search filtering | Frontend UI ready; backend filtering by tier/district/price/prakriti/rating missing |

---

## What's Complete and Working

- Clinic/retreat browsing and profiles (multi-language: EN/AR/DE/FR/ML/HI)
- Free-text search + autocomplete
- Booking flow — dates, guests, add-ons, availability checks
- Clinic admin portal — bookings, availability calendar, team, packages, image uploads (S3)
- Auth — in-memory access token, guest sessions, booking history
- Reviews system (submit + display)
- 20 DB migrations applied; `outcomes_log` append-only logging wired for bookings
- Docker dev environment (Postgres 16 + pgvector, Redis, FastAPI, Next.js)

---

## Suggested Build Order to Launch

1. **Real payment** — Stripe checkout session + webhook signature verification (~3 days)
2. **Email notifications** — booking confirmation to guest + alert to clinic (~1 day)
3. **Prakriti rebuild** — `config/questions.yaml`, `core/prakriti.py` scoring engine, `/api/assessment` endpoint, `/[lang]/assessment` page, restore `PatientProfile` columns (~4 days)
4. **Production infra** — AWS secrets, SSL, deploy pipeline, error monitoring (~2-3 days)
5. **Soft-launch** with 1-2 pilot clinics

### For Voice Assessment (post soft-launch)
- Wire `config/synonyms.yaml` intent keywords
- Build `/api/voice/*` STT → intent → TTS endpoints per provider routing in `CLAUDE.md`
- Frontend recording UI + TTS playback

---

## Feature Completion by MVP Area

| Area | Status | Notes |
|------|--------|-------|
| Search & discovery (free-text) | ✅ Done | LIKE-based; tsvector optimization deferred |
| Search (condition-based) | ❌ Missing | Needs `conditions.yaml` |
| Search (faceted filters) | ❌ Missing | Backend only |
| Prakriti assessment engine | ❌ Deleted | Needs full rebuild |
| Voice Prakriti assessment | ❌ Not started | Entire feature |
| Clinic + doctor profiles | ✅ Done | Full CRUD, multi-language, S3 photos |
| Credentialing workflow | ❌ Missing | Tier is manual/hardcoded |
| Booking flow | ✅ Done | Mock payment only |
| Real payment (Stripe/Razorpay) | ❌ Missing | |
| Email notifications | ❌ Missing | |
| Clinic admin portal | ✅ Done | Minor: "arrived" button missing |
| Outcomes logging | ✅ Partial | Booking events logged; search/assessment events not wired |
| Multi-language UI | ✅ Framework done | Translations may need content fill |
| Production deployment | ❌ Not set up | |

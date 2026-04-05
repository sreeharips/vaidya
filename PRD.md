# AyurRetreats — Product Requirements Document
**Version 1.0 | April 2026**

---

## 1. Executive Summary

AyurRetreats is an AI-powered marketplace for authentic Ayurveda wellness retreats in Kerala, India. It connects international wellness seekers — particularly Gulf NRI diaspora and European health tourists — with credentialed Ayurveda clinics, enabling discovery, personalised matching, multilingual booking, and long-term health outcome tracking.

**Core value proposition:** The right retreat, the right healer, the right programme — in your language, matched to your body.

**Business model:** Commission-based booking (7–13%) + post-retreat medicine reorders (target: >55% reorder rate by Month 12).

**North star metric:** Post-retreat medicine reorder rate.

---

## 2. Product Vision

Most wellness platforms treat Ayurveda as spa tourism. AyurRetreats is the first platform built around *authentic clinical outcomes* — credentialing clinics rigorously, matching patients to retreats by health goals, and tracking what actually healed people over time.

**Year 1 goal:** Become the most trusted place to find and book a Kerala Ayurveda retreat for the international wellness market.

**Year 3 goal:** Build the world's first outcomes-indexed Ayurveda data platform — matching patients to retreats and post-retreat medicine programmes using real outcome data.

---

## 3. Target Users

| Segment | Description | Primary Language |
|---------|-------------|-----------------|
| Gulf NRI Diaspora | UAE, Qatar, Kuwait — Malayali origin, chronic condition focus | Arabic, Malayalam, English |
| European Health Tourists | UK, DE, NL — seeking post-illness recovery or burnout healing | English, German, French |
| Domestic Indian Travellers | Kerala + metro India, wellness-aware, budget-conscious | Hindi, English |
| Clinic Administrators | Clinic managers at Kerala Ayurveda centres | Malayalam, English |

---

## 4. Platform Overview

AyurRetreats has three distinct portals:

1. **Public Platform** — Discovery, search, and booking for retreat guests
2. **Clinic Admin Portal** — Complete retreat and business management for clinic operators
3. **Platform Admin Portal** — Credentialing, oversight, and analytics for AyurRetreats operations team

---

## 5. Public Platform — User-Facing Features

### 5.1 Home Page

**Current:**
- Hero search bar with keyword input
- Featured clinic cards (hero image, tier badge, district, rating, specialisations)
- Featured retreat cards (price, duration, wellness category, inclusions)
- Wellness goals grid (links to category-filtered search)
- Condition spotlight section (back pain, stress, diabetes, etc.)

**Future:**
- AI-powered "Find my retreat" conversational flow embedded in hero
- Personalised featured section based on user's assessed Prakriti (body constitution)
- Social proof counters (guests healed, clinics verified, years of tradition)

---

### 5.2 Clinic Discovery

**Current:**
- Clinic listing page with faceted filters:
  - Wellness category (panchakarma, rejuvenation, detox, therapeutic, etc.)
  - Credentialing tier (Verified / Certified Authentic)
  - District (Thiruvananthapuram, Wayanad, Thrissur, etc.)
  - Language of service
  - Budget range
  - Rating
- Clinic detail page:
  - Gallery (hero image, photos by category)
  - About section (multi-language: EN/AR/ML)
  - Certifications and credentials
  - Team profiles (doctors and practitioners)
  - Retreat/package listings with pricing
  - Guest reviews
  - Contact and location information
  - Operating hours

**Future:**
- Map view with geo-clustering
- "Similar clinics" recommendations
- Side-by-side clinic comparison tool
- Clinic credentialing badge detail (what each certification means)
- Video clinic walkthroughs
- Real-time availability indicator on clinic listing cards

---

### 5.3 Retreat Discovery

**Current:**
- Retreat listing with filters:
  - Wellness category
  - Package type (wellness, panchakarma, therapeutic, rejuvenation, detox)
  - Price range (in user's display currency)
  - Duration (days)
  - District
  - Includes accommodation (boolean)
- Retreat detail page:
  - Full description (multi-language)
  - Pricing in user's currency (USD base, INR for domestic)
  - Duration range (min/max days)
  - What's included (accommodation, meals, transfers)
  - Daily programme schedule
  - Ideal for (conditions, goals)
  - Contraindications (who should not attend)
  - Availability calendar (next 90 days)
  - Clinic information inline
  - Book Now button with date selection

**Future:**
- Retreat comparison tool
- "Guests like you also booked" AI recommendations
- Outcome data display ("X% of guests with back pain reported improvement")
- Package bundling (retreat + post-retreat medicine plan)
- Video daily schedule preview

---

### 5.4 Search

**Current:**
- Full-text search across clinics and retreats (PostgreSQL tsvector)
- Search type filter: All / Clinic / Retreat
- Auto-suggestions as user types
- Search event logging for analytics

**Future:**
- Condition-based search: user types "I have diabetes" → system maps to relevant treatment programmes
- Multilingual keyword support (Arabic, Malayalam search terms map to English entities)
- Voice search (speak your health goal, get matched retreats)
- AI semantic search ("something for chronic fatigue that includes sea air")
- Personalised ranking based on past searches and Prakriti assessment

---

### 5.5 Prakriti (Body Constitution) Assessment

**Current (Scaffolded):**
- 22-question assessment engine
- Weighted matrix across 4 categories: physical (1.4×), digestion (1.2×), mind (1.1×), lifestyle (1.0×)
- Outputs vata/pitta/kapha percentages and dominant dosha type
- Raw answers stored for ML training (Year 2)
- No LLM in scoring — pure rule-based calculation

**Future:**
- Full assessment UI (question-by-question flow, progress bar, illustrated answers)
- Assessment result page (dosha breakdown, health profile, personalised retreat recommendations)
- Re-assessment tracking (compare Prakriti before/after retreat)
- Voice-based assessment (ask questions via voice, detect answers via speech)
- Multi-language assessment (Arabic, Malayalam, German voice + text)
- Assessment result shared with clinic on booking for personalised programme design

---

### 5.6 Voice Assessment (Premium Feature)

**Current (Architecture Defined):**
- STT routing: Deepgram Nova-3 (Arabic/Gulf), Azure Speech (European, Malayalam/Hindi)
- TTS routing: ElevenLabs Flash v2.5 (EN/AR premium), Inworld TTS-1.5 Max (European)
- Intent extraction: custom keyword-synonym dictionary; Claude Haiku fallback for <15% ambiguous inputs
- Session tracking: voice_sessions table (STT provider, intent matches, confidence scores)

**Future — Full Implementation:**
- Guided voice assessment (practitioner-like conversational experience)
- Real-time transcription display during assessment
- Language auto-detection
- Assessment confidence score display
- Voice session replay for clinic practitioners
- Pricing tiers: Standard (free text), Premium ($9 voice), Elite ($29 full voice + practitioner review)

---

### 5.7 Booking Flow

**Current:**
- Date selection with live availability check
- Guest count selection
- Guest details (name, email — pre-filled and locked for authenticated users)
- Retreat summary and pricing
- Booking request submission
- Status tracking: pending → confirmed → completed
- Booking history on user profile page
- Commission calculation: 13% international, 7% domestic

**Future:**
- Stripe payment integration (international guests)
- Razorpay integration (domestic Indian guests)
- Booking confirmation email with programme details
- Cancellation and refund flow (per-retreat cancellation policy)
- Pre-arrival questionnaire (health history for clinic)
- Concierge add-ons (airport transfer, visa letter, travel insurance)
- Group booking support
- Waitlist for sold-out dates

---

### 5.8 User Account

**Current:**
- Registration and login (email + password)
- JWT authentication (access token in-memory, refresh token in localStorage)
- Guest session support (anonymous activity tracked, linkable to account on login)
- Booking history (My Bookings page)
- Saved clinics (watchlist)
- Profile update (name, phone, language preference)

**Future:**
- Social login (Google, Apple)
- Health profile (Prakriti results, health goals, conditions)
- Booking history with outcome notes ("How did your retreat help?")
- Medicine reorder shortcut (post-retreat medicine reorder from booking history)
- Loyalty programme (early access, discounts for repeat guests)
- Push notifications (booking status updates, availability alerts for saved retreats)

---

### 5.9 Multilingual Support

**Current:**
- UI in 6 languages: English, Arabic, German, French, Malayalam, Hindi
- Clinic descriptions in EN/AR/ML
- Retreat content in EN/AR/ML
- Team bios in EN/ML
- Currency display based on user's country (INR default, USD/EUR for international)

**Future:**
- Full UI localisation for all 6 languages (currently EN primary, others partial)
- RTL layout support for Arabic
- Localised date/time formats
- Country-specific payment method defaults
- Translated email notifications

---

### 5.10 Reviews and Outcomes

**Current:**
- Review schema (rating, text, treatment type, reviewer location, verified flag)
- One review per booking (enforced)
- Reviewer identity pseudonymised (patient_pseudo_id, not email)
- outcomes_log table (append-only event log)
- Events logged: assessment_completed, booking_confirmed, medicine_ordered, review_submitted

**Future:**
- Review submission flow post-retreat (triggered by booking completion)
- Photo reviews
- Outcome surveys (structured health improvement questions 30/90/180 days post-retreat)
- Clinic response to reviews
- Aggregate outcome statistics per clinic (e.g. "87% of guests reported improvement in chronic fatigue")
- Condition-level outcome data (e.g. back pain outcomes across all clinics)

---

## 6. Clinic Admin Portal — Complete Feature Set

### 6.1 Dashboard

**Current:**
- This month's booking count
- This month's revenue
- Pending bookings count
- Upcoming bookings list

**Future:**
- Revenue trend chart (monthly, quarterly)
- Occupancy rate by retreat
- Conversion funnel (views → booking requests → confirmed)
- Top-performing retreats
- Guest demographics (country, language)
- Outcome score averages for the clinic
- Alerts (new booking requests, reviews to respond to, availability gaps)

---

### 6.2 Clinic Profile Management

**Current:**
- Edit clinic name, description (EN/ML/AR)
- Address (street, city, district, pincode, country)
- GPS coordinates (lat/lng)
- Contact (phone, email, website)
- Operating hours (per-day JSON schedule)
- Social links (Instagram, Facebook, YouTube, WhatsApp)
- Certifications list (BAMS, NABH, Kerala Tourism, etc.)
- Specialisations list
- Wellness categories
- Languages of service
- Credentialing tier (display only — set by platform admin)
- Accommodation types (available, types: garden/river/AC/private)
- Meal options
- Transport: nearest airport, nearest railway, pickup available, pickup locations
- Patient capacity
- E-commerce enabled flag

**Future:**
- Brand colour and logo customisation
- Featured image carousel ordering
- Virtual tour link (360° embed)
- Certification document upload and expiry tracking (platform reviews before displaying badge)
- Seasonal pricing overrides
- Accessibility features listing

---

### 6.3 Gallery and Image Management

**Current:**
- Upload images to S3 (categorised: clinic hero, gallery, logo, room, treatment, team photo)
- View uploaded images with category labels
- Delete images
- Display order management

**Future:**
- Drag-and-drop reorder
- Image cropping/resizing in-browser
- Bulk upload
- AI-generated alt text for accessibility
- Video upload (room tours, treatment demonstrations)

---

### 6.4 Team Management

**Current:**
- Add / edit / remove team members
- Name (EN/ML/AR)
- Qualification (BAMS, MD Ayurveda, etc.)
- Years of experience
- Bio (EN/ML)
- Profile photo upload (S3)
- Display order

**Future:**
- Doctor specialisation tags
- Doctor-specific availability (not all team available all days)
- Team member login (separate from clinic admin — limited to own profile)
- Certification document upload per practitioner
- Guest review tagging (which practitioner treated them)

---

### 6.5 Retreat and Package Management

**Current:**
- Create / edit / delete retreats
- **Retreat Details:**
  - Name (EN/AR/ML)
  - Description (EN/AR/ML)
  - Package type (wellness, panchakarma, therapeutic, rejuvenation, detox)
  - Wellness categories (multi-select)
  - Duration (min and max days)
  - Pricing: USD base + optional INR override
  - Inclusions: accommodation, meals, airport transfers
  - Max guests per slot (e.g. 2 for couples)
  - Language of instruction (multi-select)
  - Prakriti tags (vata/pitta/kapha — for AI matching)
  - Minimum age
  - What to expect (rich text)
  - Daily schedule (structured per-day)
  - Contraindications (who should not book)
  - Ideal for (conditions, goals)
  - Treatments included
  - Highlights
  - Cancellation policy
  - Photos (S3 gallery)
  - Active / inactive toggle
  - Display order
- **Availability Management:**
  - Set available spots per date
  - Block individual dates or date ranges with reason
  - Monthly calendar view (shows spots remaining, blocked dates)

**Future:**
- Seasonal pricing (different price per month/season)
- Group pricing (per-person rate for groups vs individual)
- Early bird discount configuration
- Package bundling (combine two retreats at a discount)
- Programme PDF export (for sending to guests before arrival)
- Clone retreat (duplicate and modify for seasonal variation)
- Retreat waitlist management (notify guests when a spot opens)
- AI-assisted description generation (clinic inputs bullet points, AI drafts marketing copy)

---

### 6.6 Booking Management

**Current:**
- View all bookings filtered by status: Pending / Confirmed / Completed / Cancelled
- Booking detail view (guest name, email, dates, retreat, guest count, total amount)
- Accept booking (changes status to confirmed)
- Decline booking with written reason
- Booking stats (month count, revenue, pending count)

**Future:**
- Booking calendar view (visual timeline of confirmed bookings per retreat)
- Guest pre-arrival questionnaire responses
- Internal notes per booking (practitioner prep notes)
- Payment status tracking (deposit received, balance due)
- One-click guest communication (WhatsApp or email template)
- Check-in / check-out marking
- Post-retreat follow-up trigger (auto-send outcome survey)
- Bulk export (CSV) for accounting

---

### 6.7 Reviews Management

**Future:**
- View all guest reviews for the clinic
- Flag inappropriate reviews
- Respond publicly to reviews
- Respond privately to guest
- Review analytics (rating trend, keyword themes from review text)

---

### 6.8 Analytics

**Future:**
- Revenue dashboard (daily, weekly, monthly, by retreat)
- Occupancy analytics (retreat-level fill rates by month)
- Guest demographics (country, language, booking channel)
- Conversion funnel (listing views → detail views → booking requests → confirmations)
- Search appearance data (how often did clinic appear in search, for what queries)
- Review sentiment analysis
- Outcome averages per retreat type
- Repeat guest rate

---

### 6.9 E-Commerce (Post-Retreat Medicine — Deferred)

**Schema ready, not yet implemented:**
- Product catalogue (post-retreat medicine, oils, supplements)
- Order management
- Shipping policy and return policy configuration
- Integration with booking history (clinic can recommend products post-retreat)
- Reorder flow for guests (from their booking history)

---

## 7. Platform Admin Portal

### 7.1 Clinic Management

**Current:**
- List all clinics across the platform
- Change clinic tier (Verified → Certified Authentic)
- View clinic details

**Future:**
- Clinic onboarding workflow (application → review → approval → activation)
- Certification document review queue
- Clinic suspension and reinstatement
- Messaging to clinic admins from platform
- Bulk tier reassignment

---

### 7.2 Search and Discovery Analytics

**Current:**
- Search event log (query, results count, what was clicked)

**Future:**
- Query trend dashboard (top searches by week, zero-result searches)
- Click-through rate by clinic/retreat
- Geographic search breakdown
- Language-based search analysis
- Condition interest trends (for content and credentialing investment decisions)

---

### 7.3 User Management

**Current:**
- Invite clinic admin users (assign role + clinic)
- Update roles and permissions

**Future:**
- User support view (look up guest booking history)
- Fraud and dispute management
- Guest identity verification (for high-value bookings)

---

### 7.4 Content Management

**Future:**
- Manage condition-to-treatment mapping (YAML-driven, editable via UI)
- Manage synonym dictionary for multilingual search
- Home page featured clinic/retreat curation
- Blog and editorial content (SEO articles about retreats, conditions, Kerala)
- Email campaign management (waitlist, launch, seasonal)

---

### 7.5 Finance and Payouts

**Future:**
- Commission tracking per booking
- Clinic payout schedule and history
- Stripe Connect managed payouts
- Razorpay split payment management
- Dispute and refund handling
- Monthly financial reports (platform revenue, clinic payouts, refunds)

---

## 8. AI Vision and Roadmap

### 8.1 Prakriti Matching Engine (Year 1 → Year 2)

**Year 1 (current):** Rule-based weighted matrix. 22 questions → vata/pitta/kapha percentages. No LLM.

**Year 2:** Train ML model on raw assessment answers + booking outcomes. Move from rule-based to learned matching. Input: assessment answers + health goals + demographics. Output: ranked list of retreats with predicted match confidence.

**Year 3:** Real-time adaptive matching. Model updates weekly with new outcome data. Confidence scores displayed on retreat cards for each user.

---

### 8.2 Outcomes Intelligence Platform (Year 2)

The `outcomes_log` table is append-only and has been logging since Day 1. By Year 2 the platform will have:

- Assessment scores pre-retreat
- Booking confirmation events
- Post-retreat outcome surveys (structured improvement data per condition)
- Medicine reorder signal (proxy for sustained benefit)

This dataset becomes the moat: **the world's first outcomes-indexed Ayurveda dataset.**

**Applications:**
- Condition-level outcome pages ("Back pain: 82% of guests reported improvement after 14-day panchakarma")
- Clinic ranking by outcome quality (not just reviews)
- Retreat recommendation by predicted outcome for user's specific condition
- Research partnerships (academic, insurance, government health)

---

### 8.3 Voice AI Assessment (Year 1 — Full Implementation)

The voice AI stack is architecturally defined:

| Component | Provider |
|-----------|----------|
| STT — Arabic/Gulf | Deepgram Nova-3 Arabic |
| STT — European | Azure Speech |
| STT — Malayalam/Hindi | Azure Speech |
| TTS — EN/AR | ElevenLabs Flash v2.5 |
| TTS — European | Inworld TTS-1.5 Max |
| Intent extraction | Custom keyword matcher + Claude Haiku (<15% ambiguous) |

**Full implementation plan:**
1. Build voice session UI (microphone permission, live transcription display)
2. Wire STT provider routing by language
3. Implement keyword intent extractor for 22 assessment questions
4. Implement TTS response pipeline (multi-language voice responses)
5. Store voice session transcript + intent confidence in `voice_sessions` table
6. Link voice session to Prakriti score output
7. Allow clinic to access voice session summary for programme planning

---

### 8.4 Semantic and Condition-Based Search (Year 1 — Q3)

**Current:** Full-text search only (keyword match).

**Roadmap:**
1. Restore condition-to-treatment YAML mapping (with admin UI editor)
2. Map search query → inferred condition → treatment set → ranked clinics
3. Add pgvector semantic embeddings to clinic and retreat descriptions
4. Hybrid retrieval: keyword + vector + condition mapping, ranked by tier and outcome score
5. Long-term: conversational search ("I have had joint pain for 3 years and need something in 10 days near Thrissur")

---

### 8.5 AI-Assisted Content for Clinics (Year 2)

- Clinic enters bullet points about a retreat → AI drafts multilingual marketing description (EN/AR/ML)
- AI suggests wellness categories and Prakriti tags based on retreat description
- AI flags description inconsistencies (contraindications missing, duration range implausible)
- Translation quality check for AR/ML descriptions

---

### 8.6 Post-Retreat Personalisation (Year 2)

- After a completed retreat, guest receives a personalised medicine programme recommendation
- Recommendations based on: retreat type, Prakriti score, outcome survey responses
- One-click add-to-cart from My Bookings screen
- Subscription option (monthly medicine delivery)
- This is the primary LTV driver: convert a one-time retreat guest into a recurring medicine customer

---

## 9. Technical Architecture Summary

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind, next-intl (EN/AR/DE/FR/ML/HI) |
| Backend | FastAPI (Python 3.12), async SQLAlchemy + asyncpg |
| Database | PostgreSQL 16 + pgvector (Supabase) |
| Cache | Redis (sessions, availability, matching results) |
| Storage | AWS S3 (clinic images, team photos, certificates) |
| Payments | Stripe Connect (international) + Razorpay (India) |
| Auth | JWT — access token in-memory, refresh in localStorage, guest sessions (90-day cookie) |
| Infra | AWS — Mumbai, Frankfurt, Bahrain |

---

## 10. Development Phases

### Phase 1 — MVP (Months 1–5) ✅ In Progress
- Clinic and retreat discovery
- Booking flow
- Clinic admin portal (profile, retreats, team, bookings)
- Multilingual UI (EN primary, AR/ML content)
- Guest + auth user sessions
- Outcomes logging schema

### Phase 2 — Growth (Months 6–9)
- Prakriti assessment UI (text-based)
- Voice assessment (Gulf Arabic first)
- Condition-based search
- Stripe/Razorpay payment integration
- Review submission and response
- Admin analytics dashboard

### Phase 3 — Intelligence (Months 10–18)
- ML matching engine (trained on Phase 2 outcome data)
- Semantic search with pgvector
- Post-retreat medicine e-commerce
- Outcome pages (condition-level data)
- AI content generation for clinics
- Mobile app (React Native)

### Phase 4 — Platform (Year 2+)
- Outcomes intelligence API (research and insurance partnerships)
- Franchise expansion (Bali, Rishikesh)
- White-label clinic portal
- Outcome-based pricing models (pay-per-result pilot)

---

## 11. Pre-Launch

A waitlist page is live at `/waitlist` to collect early interest emails before launch. It is architecturally isolated (`frontend/app/waitlist/`, `backend/api/waitlist.py`, one DB table) and designed to be removed entirely post-launch.

**To remove post-launch:**
1. Delete `frontend/app/waitlist/` folder
2. Delete `backend/api/waitlist.py`
3. Remove `waitlist` from `frontend/middleware.ts` matcher exclusion
4. Remove `include_router(waitlist_router)` from `backend/main.py`
5. Drop `waitlist_emails` table (Alembic downgrade or manual DROP)

---

*Document prepared: April 2026 | AyurRetreats v1.0*

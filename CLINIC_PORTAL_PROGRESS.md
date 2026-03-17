# Clinic Portal — Build Progress

> Last updated: 2026-03-17
> Track feature completion status for the `/clinic/...` staff portal.

---

## Built ✅

| Feature | Route | Notes |
|---------|-------|-------|
| Login page | `/clinic/login` | Uses shared AuthContext, redirects to `/clinic` on success |
| Dashboard | `/clinic` | 5 KPI cards (pending, confirmed, arriving today/week, revenue pending), red alert banner when pending > 0, quick links |
| Bookings list | `/clinic/bookings` | Tabs: Pending / Confirmed / Completed / All. Table with Prakriti badge, status, patient language flag |
| Booking detail | `/clinic/bookings/[id]` | Prakriti dosha bars, confirm/decline actions, treatment description, doctor, cancellation policy |
| Availability calendar | `/clinic/availability` | Month view, click to block/unblock dates, reason modal, blocked date list in sidebar |
| Clinic profile | `/clinic/profile` | Read-only — name, tier badge, district, specialisations, certifications, link to public listing |

---

## Pending — MVP scope

### High priority

- [ ] **Email/WhatsApp notification on new booking**
  - Clinics have no push notification when a patient submits a booking request
  - They only see it if they log in and check — breaks the 24-hour response SLA
  - Backend: trigger email via SendGrid/Resend on `POST /api/bookings` when status = 'pending'
  - WhatsApp: Twilio/Meta Business API (optional, higher impact for Kerala clinics)

- [ ] **Mark booking as arrived / completed**
  - Confirmed bookings need a "Patient arrived" action to move them to `completed`
  - Currently only possible via direct DB/API call
  - Add a "Mark as arrived" button on `/clinic/bookings/[id]` when status = 'confirmed' and start_date <= today

- [ ] **Sidebar tier badge — pull from API**
  - Sidebar footer currently hardcodes "Tier 1 Verified"
  - Should read from `/api/clinic/me` and show correct tier (Tier 1 / Tier 2 — Certified Authentic)
  - Fix: pass `tier` prop to `Sidebar` or fetch in the Sidebar component itself

- [ ] **Treatments management**
  - Clinics cannot view or edit their treatment catalogue from the portal
  - Read-only list as MVP: name, duration, price per day, Prakriti tags, active/inactive
  - Route: `/clinic/treatments`
  - Backend: `GET /api/clinic/treatments` (scoped to clinic)

- [ ] **Doctor roster**
  - View doctors linked to the clinic — name, qualification, specialisations, active status
  - Route: `/clinic/doctors`
  - Backend: `GET /api/clinic/doctors` (scoped to clinic)

---

### Phase 2 — post-MVP (do not build now)

- [ ] **Revenue dashboard** — commission history, payout status, invoice download
- [ ] **Multi-user per clinic** — receptionist, accounts, doctor roles with scoped access
- [ ] **Patient messaging** — in-portal thread per booking
- [ ] **Review management** — view and respond to patient reviews
- [ ] **Medicine order fulfilment** — pick/pack/ship product orders linked to post-retreat bookings

---

## Backend endpoints reference

| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/api/clinic/me` | ✅ Done |
| GET | `/api/clinic/dashboard` | ✅ Done |
| GET | `/api/clinic/bookings` | ✅ Done |
| GET | `/api/clinic/bookings/{id}` | ✅ Done |
| POST | `/api/clinic/bookings/{id}/confirm` | ✅ Done |
| POST | `/api/clinic/bookings/{id}/decline` | ✅ Done |
| GET | `/api/clinic/availability` | ✅ Done |
| POST | `/api/clinic/availability/block` | ✅ Done |
| DELETE | `/api/clinic/availability/{date}` | ✅ Done |
| POST | `/api/clinic/bookings/{id}/complete` | ⬜ Pending |
| GET | `/api/clinic/treatments` | ⬜ Pending |
| GET | `/api/clinic/doctors` | ⬜ Pending |

---

## Known issues / tech debt

- `Sidebar` footer hardcodes "Tier 1 Verified" — should be dynamic
- `pendingCount` is fetched independently on each page rather than from a shared context — minor duplication
- No loading skeleton on calendar (shows plain text "Loading…")
- Availability page does not prevent booking of blocked dates on the patient side yet (backend enforcement needed in `POST /api/bookings`)

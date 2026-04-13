# Vaidya Super Admin — Technical Documentation

## Overview

The Super Admin (Platform Admin) is a separate role from the Clinic Admin. It has full visibility across all clinics on the platform and is responsible for:

- Creating new clinic profiles
- Managing the onboarding pipeline
- Inviting clinic admin users
- Controlling clinic visibility (activate / deactivate)
- Managing the shared specialisation and certification tag lists
- Acting on behalf of any clinic in the clinic admin portal

---

## Authentication

### Role

Super admin accounts have `role = "platform_admin"` in the `users` table.

### Login

The login flow is the same as clinic admin: `POST /api/auth/login` with `email` + `password`.

The returned JWT payload includes `role: "platform_admin"`, which the frontend reads from localStorage (`admin_user`) to decide which sidebar and nav to render.

### How to create a super admin account

Run this in the backend container (or via `psql` directly):

```bash
docker exec -it vaidya-backend python -c "
import asyncio, uuid
from datetime import datetime, timezone
import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from db.models import User
import os

async def run():
    engine = create_async_engine(os.environ['DATABASE_URL'])
    async with AsyncSession(engine) as s:
        pw = bcrypt.hashpw(b'YourPassword123', bcrypt.gensalt()).decode()
        user = User(
            id=uuid.uuid4(),
            email='admin@vaidya.io',
            full_name='Platform Admin',
            password_hash=pw,
            role='platform_admin',
            is_active=True,
            is_email_verified=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        s.add(user)
        await s.commit()
        print('Created:', user.email)

asyncio.run(run())
"
```

---

## Visual Theme

| Role | Sidebar background | Accent colour | Badge |
|---|---|---|---|
| `platform_admin` | Deep indigo `#1e1b4b` | `#a5b4fc` (indigo-300) | "Platform Admin" pulsing dot |
| `clinic_admin` | Forest green | Forest green | — |

The layout (`app/admin/layout.tsx`) reads `role` from `localStorage.admin_user` and switches themes at render time.

---

## Navigation (Super Admin Sidebar)

| Item | Route |
|---|---|
| Dashboard | `/admin/platform` |
| All Clinics | `/admin/platform` (same page, scroll to table) |
| Tags | `/admin/platform/tags` |
| Users | `/admin/users` |

---

## Pages

### Dashboard — `/admin/platform`

**File:** `app/admin/platform/page.tsx`

Four stat cards:

| Card | Source |
|---|---|
| Total Clinics | `stats.total_clinics` (all, including inactive) |
| Tier 2 Certified | `stats.tier2_clinics` |
| Total Bookings | `stats.total_bookings` |
| Platform Revenue | `stats.total_revenue` (commission), sub-label shows GMV |

**Onboarding Pipeline** — clinics are bucketed by their `onboarding_pct`:

| Bucket | Range |
|---|---|
| Just created | 0–25% |
| In progress | 26–74% |
| Almost ready | 75–99% |
| Live | 100% |

**Clinic table** — searchable by name or district. Each row shows tier badge, onboarding progress bar, retreat count, booking count, live/inactive status, and a "Manage →" button.

---

### New Clinic — `/admin/platform/clinics/new`

**File:** `app/admin/platform/clinics/new/page.tsx`

Multi-section form:

| Section | Fields |
|---|---|
| Basic Info | Name, Slug (auto-generated if blank), District, Tier (1/2) |
| Contact & Location | Phone, Email, Website, Address, Lat/Lng |
| Pricing | Min price (INR), Max price (INR) |
| Tags & Credentials | Specialisations, Certifications, Languages, Atmosphere |

- Specialisations and Certifications are loaded dynamically from the database (`GET /api/admin/tags/specialisations` and `/certifications`), not hardcoded.
- Slug is auto-generated from the name if left blank (e.g. "Arya Vaidya Sala" → `arya-vaidya-sala`).
- Clinics start `is_active = false`.
- On success, redirects to the clinic hub page for that clinic.

---

### Clinic Hub — `/admin/platform/clinics/[id]`

**File:** `app/admin/platform/clinics/[id]/page.tsx`

The main control page for a single clinic. Shows:

#### Header Actions

| Button | Behaviour |
|---|---|
| Preview | Opens `/en/clinics/{slug}?preview=1` in a new tab |
| Deactivate / Set Live | Toggles `is_active` via `PATCH /activate` or `/deactivate` |
| Upgrade / Downgrade Tier | Calls `PATCH /tier` with the new tier value |

#### Quick Stats

Retreats count, team member count, photo count, bookings count.

#### Onboarding Checklist

Eight steps computed live from DB state:

| Step key | Done condition |
|---|---|
| `clinic_created` | Always done (clinic exists) |
| `description` | `description_en` has more than 50 characters |
| `photos` | At least 1 image in `clinic_images` |
| `team` | At least 1 team member in `clinic_team` |
| `retreats` | At least 1 retreat in `retreats` |
| `admin_created` | A `clinic_admin` user is linked (`admin_user_id` is set) |
| `admin_logged_in` | That user has a non-null `last_login_at` |
| `activated` | `is_active = true` |

Each incomplete step shows an action button. Clicking it sets the **clinic override** (see below) and navigates the platform admin to the relevant clinic admin page:

| Step | Navigates to |
|---|---|
| description | `/admin/clinic` |
| photos | `/admin/clinic/images` |
| team | `/admin/team` |
| retreats | `/admin/retreats` |
| activated | Inline — calls the activate endpoint |

#### Admin Account

If no admin exists, a form is shown to create one inline (email, full name, password). Calls `POST /api/admin/platform/clinics/{id}/invite`.

If an admin exists, their email, name, and last login time are shown.

#### Clinic Details

Read-only display of specialisations, certifications, contact info, and address.

---

### Tags — `/admin/platform/tags`

**File:** `app/admin/platform/tags/page.tsx`

Two-column layout: **Specialisations** and **Certifications**.

Each column has its own `TagList` component. Features per tag:

| Action | How |
|---|---|
| Add | Type in the input and press Enter or click Add |
| Edit | Double-click the tag name, or click the pencil icon |
| Activate / Deactivate | Click the pause/play icon |
| Delete | Click the trash icon (confirms before deleting) |
| Reorder | Drag and drop (active tags only) |

- Changes take effect immediately for all clinics — the clinic admin profile page reads these lists live.
- Inactive tags are shown with strikethrough and are hidden from clinic admin dropdowns.

---

## Acting on Behalf of a Clinic (Clinic Override)

A core super admin feature: the platform admin can navigate into any clinic's admin pages (`/admin/clinic`, `/admin/team`, etc.) and manage them directly.

### How it works

1. Platform admin clicks an action button on the onboarding checklist (or any other entry point).
2. `setClinicOverride(clinicId, clinicName)` saves two values to localStorage:
   - `admin_clinic_override` — the clinic UUID
   - `admin_clinic_override_name` — the clinic display name
3. Every `adminFetch()` call automatically adds an `X-Platform-Clinic: <clinicId>` header.
4. The backend's `get_admin_clinic()` dependency reads this header for `platform_admin` users and resolves the clinic from it.
5. The sidebar shows a deep indigo "Managing on behalf of {clinic name}" banner with a **Stop managing** button.
6. Clicking Stop managing calls `clearClinicOverride()`, removes the localStorage keys, and navigates back to `/admin/platform`.

### Backend — `get_admin_clinic` dependency

```
clinic_admin  → resolves clinic from admin_user_id or user.clinic_id
platform_admin → reads X-Platform-Clinic header → looks up clinic by UUID
```

If a `platform_admin` calls any endpoint protected by `get_admin_clinic` without the header, the backend returns `400 Bad Request`.

---

## Clinic Preview

An inactive clinic returns 404 on the public site. The preview system lets platform admins see how the clinic page will look before going live.

### Flow

1. Platform admin clicks **Preview** on the clinic hub page.
2. Opens `/en/clinics/{slug}?preview=1` in a new tab.
3. The Next.js page server component detects `searchParams.preview === '1'` and calls `fetchClinicPreview()` instead of `fetchClinic()`.
4. `fetchClinicPreview` hits `GET /api/clinics/{slug}?preview=true` with `cache: 'no-store'`.
5. The backend skips the `is_active` filter and skips Redis cache read/write.
6. If the clinic is inactive, a red sticky banner appears at the top of the page: **"Preview mode — This clinic is not yet live to the public."**

### Important

The backend must be restarted after code changes for the preview feature to work (FastAPI does not hot-reload in production container mode):

```bash
docker restart vaidya-backend
```

---

## API Reference

All platform admin endpoints require a valid JWT with `role = "platform_admin"`. Base path: `/api/admin/platform`.

### Stats

```
GET /api/admin/platform/stats
```

Returns: `total_clinics`, `tier1_clinics`, `tier2_clinics`, `active_clinics`, `total_bookings`, `total_gmv`, `total_revenue`, `active_retreats`, `total_team_members`.

### Clinics

| Method | Path | Description |
|---|---|---|
| GET | `/clinics` | List all clinics with onboarding % |
| POST | `/clinics` | Create a new clinic |
| GET | `/clinics/{id}` | Full clinic detail with onboarding checklist |
| PATCH | `/clinics/{id}` | Update clinic fields |
| PATCH | `/clinics/{id}/tier` | Change tier (body: `{ tier: 1 \| 2 }`) |
| PATCH | `/clinics/{id}/activate` | Set `is_active = true` |
| PATCH | `/clinics/{id}/deactivate` | Set `is_active = false` |
| POST | `/clinics/{id}/invite` | Create clinic admin account + link to clinic |

### Tags

| Method | Path | Description |
|---|---|---|
| GET | `/tags?type=specialisation\|certification` | List tags (optional filter by type) |
| POST | `/tags` | Create tag (body: `{ type, value }`) |
| PATCH | `/tags/{id}` | Update tag value or is_active |
| DELETE | `/tags/{id}` | Delete tag |
| POST | `/tags/reorder` | Reorder (body: `{ ids: [...] }`) |

---

## Database Tables

| Table | Relevant columns |
|---|---|
| `users` | `role = 'platform_admin'` |
| `clinic_feature_store` | `is_active`, `tier`, `admin_user_id`, `slug` |
| `platform_tags` | `id`, `type` (specialisation/certification), `value`, `is_active`, `sort_order` |
| `clinic_team` | Used for onboarding check |
| `clinic_images` | Used for onboarding check |
| `retreats` | Used for onboarding check |
| `bookings` | Used for revenue calculation |

---

## Frontend Utility Functions (`lib/admin-api.ts`)

| Function | Description |
|---|---|
| `getPlatformStats()` | Fetch dashboard stats |
| `getPlatformClinics()` | Fetch clinic list |
| `getPlatformClinic(id)` | Fetch single clinic detail |
| `createPlatformClinic(data)` | Create new clinic |
| `updatePlatformClinic(id, data)` | Update clinic fields |
| `activatePlatformClinic(id)` | Set live |
| `deactivatePlatformClinic(id)` | Set inactive |
| `upgradeClinicTier(id, tier)` | Change tier |
| `inviteClinicAdmin(id, data)` | Create admin account |
| `getPlatformTags(type?)` | List tags |
| `createPlatformTag(data)` | Create tag |
| `updatePlatformTag(id, data)` | Update tag |
| `deletePlatformTag(id)` | Delete tag |
| `reorderPlatformTags(ids)` | Reorder tags |
| `setClinicOverride(id, name)` | Start managing a clinic |
| `clearClinicOverride()` | Stop managing, return to platform view |
| `getClinicOverride()` | Read current override from localStorage |

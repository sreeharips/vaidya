# AyuRetreats — Pre-Launch Checklist

> Tasks to complete before launching and onboarding the first customer.
> Last updated: April 2026

---

## Business & Legal

- [ ] Register company (UAE free zone or India LLP/Pvt Ltd — decide jurisdiction)
- [ ] Open business bank account (Emirates NBD / HDFC current account)
- [ ] Get trade license / GST registration if billing from India
- [ ] Draft Terms of Service and Privacy Policy (GDPR-compliant — EU + Gulf users)
- [ ] Cancellation & refund policy document (also needed in booking flow UI)
- [ ] Clinic partner agreement / marketplace T&Cs template

---

## Domain & Hosting

- [ ] Point `ayuretreats.com` DNS to production server
- [ ] SSL certificate (Let's Encrypt or Cloudflare)
- [ ] Set up AWS production environments (Mumbai, Frankfurt, Bahrain)
- [ ] Configure Nginx for production (review existing nginx config)
- [ ] Set up staging environment separate from production

---

## Email

- [ ] Set up `@ayuretreats.com` Google Workspace or Zoho Mail (team emails)
- [ ] Integrate transactional email provider — SendGrid or Resend
- [ ] Create email templates: booking confirmation, booking request to clinic, decline/cancellation, welcome email
- [ ] Set up `noreply@ayuretreats.com` sender identity + DKIM/SPF/DMARC records
- [ ] Set up `clinics@ayuretreats.com` for clinic onboarding inquiries

---

## Payments

- [ ] Create Stripe Connect account (international patients — USD/EUR/AED)
- [ ] Create Razorpay account (India INR bookings)
- [ ] Wire real Stripe session creation in backend booking API (currently returns MOCK- refs)
- [ ] Implement Stripe webhook handler with signature verification
- [ ] Wire Razorpay order creation + webhook
- [ ] Test end-to-end payment flow in Stripe test mode
- [ ] Configure Stripe Connect for clinic payouts (marketplace split)
- [ ] Set commission % in pricing config and confirm with first clinic

---

## Image & Media Handling

- [ ] Create AWS S3 bucket for production (separate from dev bucket)
- [ ] Set S3 bucket policy + CloudFront CDN in front of it
- [ ] Configure storage module with production S3 credentials
- [ ] Set image size limits and compression (no oversized uploads)
- [ ] Test clinic image upload flow end-to-end (admin → clinic images)
- [ ] Add default fallback images for clinics/retreats with no photos

---

## Infrastructure & Security

- [ ] Rotate all dev secrets — new JWT_SECRET, DB password, Redis password for production
- [ ] Move all secrets to AWS Secrets Manager or environment-specific .env.production
- [ ] Enable PostgreSQL SSL in production
- [ ] Set up automated daily DB backups (RDS snapshots or pg_dump to S3)
- [ ] Configure Redis with password auth in production
- [ ] Set up rate limiting on auth endpoints (/api/auth/login)
- [ ] Enable CORS to production domain only (remove localhost from allowed origins)
- [ ] Set up error monitoring — Sentry (backend + frontend)
- [ ] Set up uptime monitoring — Better Uptime or UptimeRobot

---

## Analytics & Tracking

- [ ] Add Google Analytics 4 or Plausible to frontend
- [ ] Add cookie consent banner (required for GDPR — EU users)
- [ ] Verify outcomes_log is writing events on booking confirmed

---

## Product Completeness

- [ ] Wire real payment integration (blocks first real booking)
- [ ] Booking confirmation email to guest (currently missing)
- [ ] Booking alert email to clinic on new request (currently missing)
- [ ] Fix NEXT_PUBLIC_APP_URL in .env.production (metadataBase warning in logs)
- [ ] Populate config/conditions.yaml with at least 10 conditions (search depends on it)
- [ ] Test full booking flow on mobile

---

## First Clinic Onboarding

- [ ] Create clinic admin user via platform admin portal
- [ ] Walk clinic through profile setup — description, photos, team, certifications
- [ ] Create at least 2 retreat packages with pricing and availability
- [ ] Verify clinic appears in search results
- [ ] Do a test booking end-to-end as a patient
- [ ] Confirm clinic receives booking notification

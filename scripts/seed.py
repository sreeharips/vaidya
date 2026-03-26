#!/usr/bin/env python3
"""
scripts/seed.py — Full development seed: 50 clinics, wellness packages,
team members, patients, bookings and reviews.

Run from project root:
    python scripts/seed.py            # seed (skip existing rows)
    python scripts/seed.py --reset    # wipe seed data and re-seed

Deterministic: random.seed(42) — every run produces identical data.
"""
import argparse
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

# ── Path / env setup ──────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

env_file = ROOT / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from db.models import (
    Base,
    Booking,
    ClinicFeatureStore,
    ClinicTeam,
    PackageAvailability,
    PatientProfile,
    Review,
    WellnessPackage,
)

DATABASE_SYNC_URL = os.environ.get(
    "DATABASE_SYNC_URL",
    "postgresql://vaidya:vaidya_dev@localhost:5432/vaidya",
).replace("@postgres:", "@localhost:")

engine = create_engine(DATABASE_SYNC_URL, echo=False)
RNG = random.Random(42)   # deterministic — same data every run

# ── Vocabulary pools ──────────────────────────────────────────────────────────

DISTRICTS = [
    {"name": "Thiruvananthapuram", "lat": 8.5241,  "lng": 76.9366},
    {"name": "Kollam",             "lat": 8.8932,  "lng": 76.6141},
    {"name": "Pathanamthitta",     "lat": 9.2648,  "lng": 76.7870},
    {"name": "Alappuzha",          "lat": 9.4981,  "lng": 76.3388},
    {"name": "Kottayam",           "lat": 9.5916,  "lng": 76.5222},
    {"name": "Idukki",             "lat": 9.9189,  "lng": 77.1025},
    {"name": "Ernakulam",          "lat": 9.9312,  "lng": 76.2673},
    {"name": "Thrissur",           "lat": 10.5276, "lng": 76.2144},
    {"name": "Palakkad",           "lat": 10.7867, "lng": 76.6548},
    {"name": "Malappuram",         "lat": 11.0730, "lng": 76.0740},
    {"name": "Kozhikode",          "lat": 11.2588, "lng": 75.7804},
    {"name": "Wayanad",            "lat": 11.6854, "lng": 76.1320},
    {"name": "Kannur",             "lat": 11.8745, "lng": 75.3704},
    {"name": "Kasaragod",          "lat": 12.4996, "lng": 74.9869},
]

CLINIC_PREFIXES = [
    "Arya", "Vaidyaratnam", "Dhanwantari", "Amrita", "Santhigiri", "Kairali",
    "Nagarjuna", "Athreya", "Pankajakasthuri", "Elixir", "Nirmala", "Suvarna",
    "Kerala Heritage", "Vedic", "Ashoka", "Brahma", "Kalari", "Malabar",
    "Lakshmi", "Prana", "Sukha", "Ojas", "Bala", "Surya", "Soma",
]

CLINIC_SUFFIXES = [
    "Ayurveda Village",
    "Ayurvedic Hospital",
    "Ayurveda Retreat",
    "Nature Cure Centre",
    "Wellness Resort",
    "Heritage Ayurveda",
    "Panchakarma Centre",
    "Ayurvedic Institute",
    "Treatment Centre",
    "Holistic Health Centre",
]

ALL_SPECIALISATIONS = [
    "panchakarma", "shirodhara", "pizhichil", "kizhi", "abhyanga",
    "nasya", "virechana", "basti", "udvartana", "rasayana",
    "kati-basti", "janu-basti", "takradhara", "njavara-kizhi",
    "lepa", "yoga-therapy", "diet-counselling",
]

WELLNESS_CATEGORIES = [
    "detox-cleanse", "stress-relief", "pain-management", "weight-wellness",
    "skin-hair", "immunity-boost", "fertility-wellness", "anti-aging",
    "digestive-health", "mental-clarity", "joint-mobility", "post-surgery",
]

CERTIFICATIONS = [
    "AYUSH Registered", "NABH Accredited", "GMP Certified",
    "ISO 9001:2015", "Kerala Tourism Approved", "FSSAI Licensed",
]

LANGUAGES = ["en", "ml", "hi", "ar", "de", "fr"]

# Wellness package templates
PACKAGE_TEMPLATES = [
    {
        "name": "Classic Panchakarma Detox",
        "type": "panchakarma",
        "categories": ["detox-cleanse", "digestive-health"],
        "duration_min": 14, "duration_max": 21,
        "price_usd": 120, "price_inr": 9500,
        "includes_accommodation": True, "includes_meals": True,
        "description": "A comprehensive 14–21 day Panchakarma programme combining all five detox therapies. Includes daily treatments, herbal medicines, yoga sessions, and Ayurvedic diet.",
    },
    {
        "name": "Stress Relief Retreat",
        "type": "wellness",
        "categories": ["stress-relief", "mental-clarity"],
        "duration_min": 7, "duration_max": 14,
        "price_usd": 95, "price_inr": 7500,
        "includes_accommodation": True, "includes_meals": True,
        "description": "A calming retreat with Shirodhara, Abhyanga, meditation, and yoga. Designed for burnout recovery and mental clarity.",
    },
    {
        "name": "Joint & Spine Care",
        "type": "therapeutic",
        "categories": ["pain-management", "joint-mobility"],
        "duration_min": 7, "duration_max": 14,
        "price_usd": 110, "price_inr": 8500,
        "includes_accommodation": True, "includes_meals": False,
        "description": "Targeted Kati Basti, Janu Basti, and Pizhichil therapies for chronic back pain, knee problems, and arthritis.",
    },
    {
        "name": "Rejuvenation Escape",
        "type": "rejuvenation",
        "categories": ["anti-aging", "immunity-boost"],
        "duration_min": 7, "duration_max": 21,
        "price_usd": 130, "price_inr": 10000,
        "includes_accommodation": True, "includes_meals": True,
        "description": "A luxurious Rasayana programme for deep rejuvenation. Includes Njavara Kizhi, Abhyanga, herbal baths, and personalised diet.",
    },
    {
        "name": "Weekend Wellness",
        "type": "wellness",
        "categories": ["stress-relief", "immunity-boost"],
        "duration_min": 3, "duration_max": 5,
        "price_usd": 150, "price_inr": 12000,
        "includes_accommodation": True, "includes_meals": True,
        "description": "A short getaway with daily Abhyanga, Shirodhara, yoga, and Ayurvedic cuisine. Perfect for first-timers.",
    },
    {
        "name": "Weight Management Programme",
        "type": "therapeutic",
        "categories": ["weight-wellness", "digestive-health"],
        "duration_min": 14, "duration_max": 28,
        "price_usd": 90, "price_inr": 7000,
        "includes_accommodation": True, "includes_meals": True,
        "description": "Udvartana, Virechana, and diet-based programme to support healthy weight loss with lasting results.",
    },
    {
        "name": "Skin & Beauty Retreat",
        "type": "wellness",
        "categories": ["skin-hair", "anti-aging"],
        "duration_min": 7, "duration_max": 14,
        "price_usd": 105, "price_inr": 8000,
        "includes_accommodation": True, "includes_meals": True,
        "description": "Takradhara, Lepa, herbal facials and internal medicines for radiant skin and hair health.",
    },
]

# Team member name pools
FIRST_NAMES = [
    "Dr. Krishnan", "Dr. Lakshmi", "Dr. Gopinath", "Dr. Jayalakshmi",
    "Dr. Rajeev", "Dr. Sreelatha", "Dr. Suresh", "Dr. Asha",
    "Dr. Mohan", "Dr. Deepa", "Dr. Anil", "Dr. Priya",
    "Dr. Rajan", "Dr. Meera", "Dr. Vinod", "Dr. Geetha",
    "Dr. Manoj", "Dr. Rema", "Dr. Prasad", "Dr. Sindhu",
]

QUALIFICATIONS = [
    "BAMS, MD (Ay)", "BAMS", "BAMS, MSc (Yoga)", "BAMS, PhD",
    "BAMS, Diploma in Panchakarma", "MD (Ay), FRAV",
]

REVIEW_TEXTS = [
    "Truly life-changing experience. The treatments were authentic and the staff incredibly caring.",
    "Came for back pain relief and left feeling 20 years younger. Will definitely return.",
    "Beautiful setting, knowledgeable doctors, and genuine Ayurvedic treatments. Highly recommend.",
    "The Panchakarma programme was intense but so worth it. My digestive issues have completely resolved.",
    "Perfect balance of treatment and relaxation. The food was exceptional too.",
    "My third visit and it gets better every time. The team remembers my preferences.",
    "Fantastic wellness retreat. The Shirodhara sessions were deeply relaxing.",
    "Professional, clean, and well-organised. The consultation was thorough and personalised.",
    "Exceeded all expectations. Real Ayurveda, not the touristy version.",
    "The yoga and meditation alongside treatments made all the difference.",
]

PATIENT_LOCATIONS = [
    "Dubai, UAE", "Abu Dhabi, UAE", "London, UK", "Berlin, Germany",
    "Amsterdam, Netherlands", "Munich, Germany", "Doha, Qatar",
    "Kuwait City, Kuwait", "Kochi, India", "Mumbai, India",
    "Bangalore, India", "Chennai, India", "Delhi, India",
]

# ── Seed functions ────────────────────────────────────────────────────────────

def _slug(name: str, district: str) -> str:
    return f"{name.lower().replace(' ', '-').replace('.', '')}-{district.lower()}"


def seed_clinics(session: Session, count: int = 50) -> list:
    existing = session.execute(text("SELECT COUNT(*) FROM clinic_feature_store")).scalar()
    if existing and existing >= count:
        print(f"  ✓ {existing} clinics already exist, skipping")
        return list(session.execute(text("SELECT id FROM clinic_feature_store")).scalars().all())

    clinic_ids = []
    used_names = set()

    for i in range(count):
        prefix = CLINIC_PREFIXES[i % len(CLINIC_PREFIXES)]
        suffix = CLINIC_SUFFIXES[i % len(CLINIC_SUFFIXES)]
        name = f"{prefix} {suffix}"
        while name in used_names:
            prefix = RNG.choice(CLINIC_PREFIXES)
            name = f"{prefix} {suffix}"
        used_names.add(name)

        district = DISTRICTS[i % len(DISTRICTS)]
        tier = 2 if i < 15 else 1
        specs = RNG.sample(ALL_SPECIALISATIONS, RNG.randint(4, 8))
        categories = RNG.sample(WELLNESS_CATEGORIES, RNG.randint(3, 6))
        langs = ["en", "ml"] + RNG.sample(["hi", "ar", "de", "fr"], RNG.randint(0, 3))
        certs = RNG.sample(CERTIFICATIONS, RNG.randint(1, 4))

        cid = uuid.uuid4()
        clinic = ClinicFeatureStore(
            id=cid,
            slug=_slug(name, district["name"]),
            name=name,
            tier=tier,
            district=district["name"],
            lat=district["lat"] + RNG.uniform(-0.1, 0.1),
            lng=district["lng"] + RNG.uniform(-0.1, 0.1),
            specialisations=specs,
            wellness_categories=categories,
            languages=langs,
            pricing_min=RNG.choice([60, 75, 90, 100]),
            pricing_max=RNG.choice([120, 150, 180, 200, 250]),
            certifications=certs,
            accommodation_available=True,
            outcome_enrolled=tier == 2,
            is_active=True,
            rating=round(RNG.uniform(3.5, 5.0), 1),
            review_count=RNG.randint(5, 120),
            description_en=f"Welcome to {name}, a premier Ayurvedic wellness retreat in {district['name']}, Kerala. We offer authentic treatments rooted in centuries-old traditions.",
            address=f"{RNG.randint(1, 999)} {district['name']} Main Road, {district['name']}, Kerala",
            phone=f"+91 {RNG.randint(7000, 9999)} {RNG.randint(100000, 999999)}",
            email=f"info@{prefix.lower().replace(' ', '')}.com",
        )
        session.add(clinic)
        clinic_ids.append(cid)

    session.flush()
    print(f"  ✓ Seeded {count} clinics")
    return clinic_ids


def seed_team(session: Session, clinic_ids: list) -> None:
    existing = session.execute(text("SELECT COUNT(*) FROM clinic_team")).scalar()
    if existing and existing > 0:
        print(f"  ✓ {existing} team members already exist, skipping")
        return

    count = 0
    for cid in clinic_ids:
        num_members = RNG.randint(2, 5)
        used_names = set()
        for j in range(num_members):
            name = RNG.choice(FIRST_NAMES)
            while name in used_names:
                name = RNG.choice(FIRST_NAMES)
            used_names.add(name)

            member = ClinicTeam(
                clinic_id=cid,
                name=name,
                qualification=RNG.choice(QUALIFICATIONS),
                years_experience=RNG.randint(3, 30),
                bio_en=f"{name} is an experienced Ayurvedic practitioner specialising in Panchakarma and traditional Kerala therapies.",
                display_order=j,
                is_active=True,
            )
            session.add(member)
            count += 1

    session.flush()
    print(f"  ✓ Seeded {count} team members across {len(clinic_ids)} clinics")


def seed_packages(session: Session, clinic_ids: list) -> list:
    existing = session.execute(text("SELECT COUNT(*) FROM wellness_packages")).scalar()
    if existing and existing > 0:
        print(f"  ✓ {existing} packages already exist, skipping")
        return list(session.execute(text("SELECT id FROM wellness_packages")).scalars().all())

    package_ids = []
    for cid in clinic_ids:
        num_packages = RNG.randint(3, 6)
        templates = RNG.sample(PACKAGE_TEMPLATES, min(num_packages, len(PACKAGE_TEMPLATES)))

        for j, tmpl in enumerate(templates):
            pid = uuid.uuid4()
            price_variation = RNG.uniform(0.8, 1.3)
            package = WellnessPackage(
                id=pid,
                clinic_id=cid,
                name=tmpl["name"],
                name_display_en=tmpl["name"],
                description_en=tmpl["description"],
                package_type=tmpl["type"],
                wellness_categories=tmpl["categories"],
                duration_min_days=tmpl["duration_min"],
                duration_max_days=tmpl["duration_max"],
                price_usd=round(tmpl["price_usd"] * price_variation, 2),
                price_inr=round(tmpl["price_inr"] * price_variation, 2) if tmpl.get("price_inr") else None,
                includes_accommodation=tmpl["includes_accommodation"],
                includes_meals=tmpl.get("includes_meals", False),
                max_guests_per_slot=RNG.choice([2, 4, 6, 8]),
                is_active=True,
                display_order=j,
            )
            session.add(package)
            package_ids.append(pid)

    session.flush()
    print(f"  ✓ Seeded {len(package_ids)} packages across {len(clinic_ids)} clinics")
    return package_ids


def seed_availability(session: Session, package_ids: list) -> None:
    existing = session.execute(text("SELECT COUNT(*) FROM package_availability")).scalar()
    if existing and existing > 0:
        print(f"  ✓ {existing} availability records already exist, skipping")
        return

    today = date.today()
    count = 0
    for pid in package_ids:
        # Seed 90 days of availability
        for day_offset in range(90):
            d = today + timedelta(days=day_offset)
            is_blocked = RNG.random() < 0.05  # 5% chance blocked
            avail = PackageAvailability(
                package_id=pid,
                date=d,
                available_spots=0 if is_blocked else RNG.randint(1, 6),
                is_blocked=is_blocked,
                block_reason="Fully booked" if is_blocked else None,
            )
            session.add(avail)
            count += 1

    session.flush()
    print(f"  ✓ Seeded {count} availability records (90 days × {len(package_ids)} packages)")


def seed_patients(session: Session, count: int = 200) -> list:
    existing = session.execute(text("SELECT COUNT(*) FROM patient_profiles")).scalar()
    if existing and existing >= count:
        print(f"  ✓ {existing} patients already exist, skipping")
        return list(session.execute(text("SELECT pseudo_id FROM patient_profiles")).scalars().all())

    pseudo_ids = []
    for i in range(count):
        pid = f"seed-patient-{i:04d}"
        lang = RNG.choice(LANGUAGES)
        dosha = RNG.choice(["vata", "pitta", "kapha", "vata-pitta", "pitta-kapha", "vata-kapha"])
        patient = PatientProfile(
            pseudo_id=pid,
            language=lang,
            dosha_type=dosha,
            prakriti_scores={"vata": RNG.randint(20, 50), "pitta": RNG.randint(20, 50), "kapha": RNG.randint(20, 50)},
            assessment_status="completed" if RNG.random() > 0.3 else "pending",
        )
        session.add(patient)
        pseudo_ids.append(pid)

    session.flush()
    print(f"  ✓ Seeded {count} patient profiles")
    return pseudo_ids


def seed_bookings(session: Session, clinic_ids: list, package_ids: list, pseudo_ids: list, count: int = 300) -> list:
    existing = session.execute(text("SELECT COUNT(*) FROM bookings")).scalar()
    if existing and existing >= count:
        print(f"  ✓ {existing} bookings already exist, skipping")
        return list(session.execute(text("SELECT id FROM bookings")).scalars().all())

    booking_ids = []
    statuses = ["completed", "completed", "completed", "confirmed", "confirmed", "pending", "cancelled"]

    for i in range(count):
        cid = RNG.choice(clinic_ids)
        # Pick a package belonging to this clinic (or random if not matched)
        pkg_id = RNG.choice(package_ids)
        patient = RNG.choice(pseudo_ids)
        status = RNG.choice(statuses)
        lang = RNG.choice(LANGUAGES)
        start = date.today() - timedelta(days=RNG.randint(-30, 180))
        nights = RNG.randint(3, 21)
        end = start + timedelta(days=nights)
        price_per_night = RNG.uniform(60, 200)
        guest_count = RNG.randint(1, 3)
        total = round(price_per_night * nights * guest_count, 2)
        rate = 0.13 if lang in ("ar", "de", "fr") else 0.07
        commission = round(total * rate, 2)

        bid = uuid.uuid4()
        booking = Booking(
            id=bid,
            patient_pseudo_id=patient,
            clinic_id=cid,
            package_id=pkg_id,
            guest_name=f"Guest {i + 1}",
            guest_email=f"guest{i + 1}@example.com" if RNG.random() > 0.3 else None,
            guest_count=guest_count,
            start_date=start,
            end_date=end,
            status=status,
            total_amount=total,
            commission_amount=commission,
            currency="USD",
            lang=lang,
            payment_ref=f"pi_seed_{uuid.uuid4().hex[:16]}" if status in ("confirmed", "completed") else None,
        )
        session.add(booking)
        booking_ids.append(bid)

    session.flush()
    print(f"  ✓ Seeded {count} bookings")
    return booking_ids


def seed_reviews(session: Session, clinic_ids: list, booking_ids: list, pseudo_ids: list, count: int = 200) -> None:
    existing = session.execute(text("SELECT COUNT(*) FROM reviews")).scalar()
    if existing and existing >= count:
        print(f"  ✓ {existing} reviews already exist, skipping")
        return

    used_bookings = set()
    seeded = 0
    for i in range(count):
        bid = booking_ids[i % len(booking_ids)]
        if bid in used_bookings:
            continue
        used_bookings.add(bid)

        review = Review(
            patient_pseudo_id=RNG.choice(pseudo_ids),
            clinic_id=RNG.choice(clinic_ids),
            booking_id=bid,
            rating=RNG.choice([3, 4, 4, 4, 5, 5, 5, 5]),
            review_text=RNG.choice(REVIEW_TEXTS),
            reviewer_location=RNG.choice(PATIENT_LOCATIONS),
            verified=RNG.random() > 0.2,
        )
        session.add(review)
        seeded += 1

    session.flush()
    print(f"  ✓ Seeded {seeded} reviews")


def reset_seed_data(session: Session) -> None:
    """Remove all seed data (reverse order of creation)."""
    print("  Resetting seed data...")
    session.execute(text("DELETE FROM reviews WHERE patient_pseudo_id LIKE 'seed-patient-%'"))
    session.execute(text("DELETE FROM bookings WHERE patient_pseudo_id LIKE 'seed-patient-%'"))
    session.execute(text("DELETE FROM patient_profiles WHERE pseudo_id LIKE 'seed-patient-%'"))
    session.execute(text("DELETE FROM package_availability"))
    session.execute(text("DELETE FROM wellness_packages"))
    session.execute(text("DELETE FROM clinic_team"))
    session.execute(text("DELETE FROM clinic_feature_store"))
    session.commit()
    print("  ✓ Reset complete")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed Vaidya development database")
    parser.add_argument("--reset", action="store_true", help="Wipe seed data before re-seeding")
    args = parser.parse_args()

    print("🌱 Vaidya seed script")
    print(f"  DB: {DATABASE_SYNC_URL.split('@')[-1]}")

    with Session(engine) as session:
        if args.reset:
            reset_seed_data(session)

        clinic_ids = seed_clinics(session, count=50)
        seed_team(session, clinic_ids)
        package_ids = seed_packages(session, clinic_ids)
        seed_availability(session, package_ids)
        pseudo_ids = seed_patients(session, count=200)
        booking_ids = seed_bookings(session, clinic_ids, package_ids, pseudo_ids, count=300)
        seed_reviews(session, clinic_ids, booking_ids, pseudo_ids, count=200)

        session.commit()
        print("\n✅ Seed complete!")


if __name__ == "__main__":
    main()

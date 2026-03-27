#!/usr/bin/env python3
"""
scripts/seed.py — Full development seed: 50 retreats/clinics, wellness packages,
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
# In Docker the backend code lives at /app (scripts/ is a subdir of /app).
# On the host it lives at <root>/backend/.
_backend = ROOT / "backend"
sys.path.insert(0, str(_backend if _backend.is_dir() else ROOT))

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

_raw_url = os.environ.get(
    "DATABASE_SYNC_URL",
    os.environ.get("DATABASE_URL", "postgresql://vaidya:vaidya_dev@localhost:5432/vaidya"),
)
# Strip async driver prefix so psycopg2 can connect synchronously
_raw_url = _raw_url.replace("+asyncpg", "").replace("+aiosqlite", "")
# When running from the host machine, replace the Docker service name with localhost
import socket as _socket
try:
    _socket.gethostbyname("postgres")
    DATABASE_SYNC_URL = _raw_url  # inside Docker — postgres hostname resolves fine
except OSError:
    DATABASE_SYNC_URL = _raw_url.replace("@postgres:", "@localhost:")  # host machine

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

# ── Tier 2 (Certified Authentic) — real-sounding Kerala retreat names ─────────
TIER2_RETREATS = [
    {
        "name": "Somatheeram Ayurvedic Village",
        "district": "Thiruvananthapuram",
        "desc": "Kerala's first Ayurvedic resort, nestled on a cliff overlooking the Arabian Sea. "
                "Internationally recognised for authentic Panchakarma and rejuvenation programmes.",
        "certs": ["AYUSH Registered", "Kerala Tourism Approved", "NABH Accredited"],
        "categories": ["detox-cleanse", "stress-relief", "anti-aging", "digestive-health"],
        "rating": 4.9, "reviews": 312,
    },
    {
        "name": "Kairali Ayurvedic Health Village",
        "district": "Palakkad",
        "desc": "Set in 50 acres of lush greenery in Palakkad, Kairali offers comprehensive Panchakarma detox, "
                "weight management, and rejuvenation retreats with BAMS-qualified doctors.",
        "certs": ["AYUSH Registered", "GMP Certified", "ISO 9001:2015"],
        "categories": ["detox-cleanse", "weight-wellness", "immunity-boost", "joint-mobility"],
        "rating": 4.8, "reviews": 276,
    },
    {
        "name": "Kalari Kovilakom Heritage Palace",
        "district": "Palakkad",
        "desc": "A restored 19th-century palace offering the most exclusive Panchakarma retreat in Kerala. "
                "No phones, no television — pure healing in a heritage setting.",
        "certs": ["AYUSH Registered", "Kerala Tourism Approved", "NABH Accredited", "GMP Certified"],
        "categories": ["detox-cleanse", "mental-clarity", "stress-relief", "anti-aging"],
        "rating": 4.9, "reviews": 198,
    },
    {
        "name": "Vaidyaratnam Ayurveda Village",
        "district": "Thrissur",
        "desc": "Connected to the legendary Vaidyaratnam Oushadhasala, this retreat combines "
                "five-century-old Kerala Ayurveda with contemporary wellness. GMP-certified medicines prepared on site.",
        "certs": ["AYUSH Registered", "GMP Certified", "NABH Accredited"],
        "categories": ["detox-cleanse", "pain-management", "digestive-health", "joint-mobility"],
        "rating": 4.8, "reviews": 245,
    },
    {
        "name": "Arya Vaidya Sala Retreat",
        "district": "Malappuram",
        "desc": "The retreat arm of the historic Arya Vaidya Sala Kottakkal, offering authentic classical "
                "Ayurveda treatments using their own GMP-certified herbal preparations.",
        "certs": ["AYUSH Registered", "GMP Certified", "ISO 9001:2015", "NABH Accredited"],
        "categories": ["detox-cleanse", "digestive-health", "immunity-boost", "anti-aging"],
        "rating": 4.7, "reviews": 189,
    },
    {
        "name": "Poovar Island Ayurveda Resort",
        "district": "Thiruvananthapuram",
        "desc": "An island retreat accessible only by boat, surrounded by backwaters, sea, and forest. "
                "Combines authentic Ayurveda with Kerala's most spectacular natural setting.",
        "certs": ["AYUSH Registered", "Kerala Tourism Approved", "ISO 9001:2015"],
        "categories": ["stress-relief", "detox-cleanse", "mental-clarity", "skin-hair"],
        "rating": 4.7, "reviews": 167,
    },
    {
        "name": "Dhanwantari Heritage Wellness",
        "district": "Kottayam",
        "desc": "A family-run heritage retreat with five generations of Ayurvedic practice. "
                "Specialises in traditional Kizhi and Pizhichil therapies for musculoskeletal conditions.",
        "certs": ["AYUSH Registered", "GMP Certified", "Kerala Tourism Approved"],
        "categories": ["pain-management", "joint-mobility", "detox-cleanse", "post-surgery"],
        "rating": 4.6, "reviews": 143,
    },
    {
        "name": "Santhigiri Holistic Health Village",
        "district": "Thiruvananthapuram",
        "desc": "A spiritual-medical retreat blending traditional Ayurveda with yogic philosophy. "
                "Known for Rasayana rejuvenation and immunity-building programmes.",
        "certs": ["AYUSH Registered", "NABH Accredited", "Kerala Tourism Approved"],
        "categories": ["immunity-boost", "anti-aging", "mental-clarity", "stress-relief"],
        "rating": 4.6, "reviews": 134,
    },
    {
        "name": "Athreya Ayurvedic Retreat",
        "district": "Thrissur",
        "desc": "A purpose-built wellness retreat designed by BAMS doctors specialising in chronic conditions. "
                "Evidence-based Ayurveda with outcome tracking for all patients.",
        "certs": ["AYUSH Registered", "GMP Certified", "NABH Accredited"],
        "categories": ["pain-management", "digestive-health", "weight-wellness", "joint-mobility"],
        "rating": 4.7, "reviews": 156,
    },
    {
        "name": "Nagarjuna Ayurvedic Village",
        "district": "Ernakulam",
        "desc": "One of Kerala's best-known Ayurvedic brands, with a lush campus retreat near Kochi. "
                "Expert in Panchakarma, Navarakizhi, and classical skin treatments.",
        "certs": ["AYUSH Registered", "GMP Certified", "ISO 9001:2015"],
        "categories": ["detox-cleanse", "skin-hair", "digestive-health", "anti-aging"],
        "rating": 4.5, "reviews": 211,
    },
    {
        "name": "Malabar Heritage Wellness Retreat",
        "district": "Kozhikode",
        "desc": "A boutique retreat perched on Malabar hills, blending northern Kerala Ayurvedic traditions "
                "with contemporary hospitality. Arabic and Malayalam spoken.",
        "certs": ["AYUSH Registered", "Kerala Tourism Approved"],
        "categories": ["stress-relief", "detox-cleanse", "immunity-boost", "mental-clarity"],
        "rating": 4.5, "reviews": 98,
    },
    {
        "name": "Wayanad Forest Ayurveda Retreat",
        "district": "Wayanad",
        "desc": "Nestled in 20 acres of cardamom and coffee estates at 900m elevation. "
                "Cool mountain climate enhances Panchakarma efficacy and recovery.",
        "certs": ["AYUSH Registered", "Kerala Tourism Approved", "ISO 9001:2015"],
        "categories": ["detox-cleanse", "stress-relief", "mental-clarity", "immunity-boost"],
        "rating": 4.6, "reviews": 87,
    },
    {
        "name": "Backwaters Ayurveda Village",
        "district": "Alappuzha",
        "desc": "A unique floating-and-shore retreat on the Alleppey backwaters. "
                "Houseboats converted into treatment suites — healing with Kerala's iconic waterways as backdrop.",
        "certs": ["AYUSH Registered", "Kerala Tourism Approved", "GMP Certified"],
        "categories": ["stress-relief", "detox-cleanse", "skin-hair", "weight-wellness"],
        "rating": 4.5, "reviews": 112,
    },
    {
        "name": "Kalari Rasayana Retreat",
        "district": "Thiruvananthapuram",
        "desc": "Combines Kalaripayattu (Kerala martial art) with Ayurvedic therapies for a unique "
                "mind-body healing experience. Specialises in musculoskeletal recovery and athletic performance.",
        "certs": ["AYUSH Registered", "Kerala Tourism Approved"],
        "categories": ["pain-management", "joint-mobility", "immunity-boost", "stress-relief"],
        "rating": 4.7, "reviews": 76,
    },
    {
        "name": "Kannur Heritage Ayurveda Resort",
        "district": "Kannur",
        "desc": "A historically rich retreat in Kannur, the cradle of Theyyam ritual culture. "
                "Authentic northern Kerala Ayurveda traditions, rare tribal formulations.",
        "certs": ["AYUSH Registered", "GMP Certified", "Kerala Tourism Approved"],
        "categories": ["detox-cleanse", "digestive-health", "anti-aging", "immunity-boost"],
        "rating": 4.4, "reviews": 63,
    },
]

# ── Tier 1 (Verified clinics) — name components ───────────────────────────────
CLINIC_PREFIXES = [
    "Amrita", "Elixir", "Nirmala", "Suvarna", "Vedic", "Ashoka",
    "Brahma", "Lakshmi", "Prana", "Sukha", "Ojas", "Bala", "Surya",
    "Soma", "Chandra", "Indra", "Varuna", "Agni", "Vata", "Pitta",
    "Kapha", "Tridosha", "Panchabhoota", "Sapta", "Ashtanga",
]

RETREAT_SUFFIXES = [
    "Ayurveda Retreat",
    "Wellness Retreat",
    "Ayurvedic Village",
    "Nature Retreat",
    "Wellness Resort",
    "Heritage Ayurveda",
    "Panchakarma Retreat",
    "Healing Retreat",
    "Wellness Sanctuary",
    "Ayurveda Sanctuary",
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

# Picsum deterministic placeholders (seed = slug first 12 chars)
def photo_url(slug: str, w: int = 800, h: int = 600) -> str:
    return f"https://picsum.photos/seed/{slug[:16]}/{w}/{h}"

# Wellness package templates
PACKAGE_TEMPLATES = [
    {
        "name": "Classic Panchakarma Detox",
        "type": "panchakarma",
        "categories": ["detox-cleanse", "digestive-health"],
        "duration_min": 14, "duration_max": 21,
        "price_usd": 120, "price_inr": 9500,
        "includes_accommodation": True, "includes_meals": True,
        "description": "A comprehensive 14–21 day Panchakarma programme combining all five detox therapies. "
                       "Includes daily treatments, herbal medicines, yoga sessions, and Ayurvedic diet.",
    },
    {
        "name": "Stress Relief & Mind Reset",
        "type": "wellness",
        "categories": ["stress-relief", "mental-clarity"],
        "duration_min": 7, "duration_max": 14,
        "price_usd": 95, "price_inr": 7500,
        "includes_accommodation": True, "includes_meals": True,
        "description": "A calming retreat with Shirodhara, Abhyanga, meditation, and yoga. "
                       "Designed for burnout recovery and mental clarity.",
    },
    {
        "name": "Joint & Spine Care",
        "type": "therapeutic",
        "categories": ["pain-management", "joint-mobility"],
        "duration_min": 7, "duration_max": 14,
        "price_usd": 110, "price_inr": 8500,
        "includes_accommodation": True, "includes_meals": False,
        "description": "Targeted Kati Basti, Janu Basti, and Pizhichil therapies for chronic back pain, "
                       "knee problems, and arthritis.",
    },
    {
        "name": "Rasayana Rejuvenation",
        "type": "rejuvenation",
        "categories": ["anti-aging", "immunity-boost"],
        "duration_min": 7, "duration_max": 21,
        "price_usd": 130, "price_inr": 10000,
        "includes_accommodation": True, "includes_meals": True,
        "description": "A luxurious Rasayana programme for deep rejuvenation. Includes Njavara Kizhi, "
                       "Abhyanga, herbal baths, and personalised diet.",
    },
    {
        "name": "Weekend Wellness Escape",
        "type": "wellness",
        "categories": ["stress-relief", "immunity-boost"],
        "duration_min": 3, "duration_max": 5,
        "price_usd": 150, "price_inr": 12000,
        "includes_accommodation": True, "includes_meals": True,
        "description": "A short getaway with daily Abhyanga, Shirodhara, yoga, and Ayurvedic cuisine. "
                       "Perfect for first-timers.",
    },
    {
        "name": "Weight & Metabolism Programme",
        "type": "therapeutic",
        "categories": ["weight-wellness", "digestive-health"],
        "duration_min": 14, "duration_max": 28,
        "price_usd": 90, "price_inr": 7000,
        "includes_accommodation": True, "includes_meals": True,
        "description": "Udvartana, Virechana, and diet-based programme to support healthy weight loss "
                       "with lasting results.",
    },
    {
        "name": "Skin & Beauty Retreat",
        "type": "wellness",
        "categories": ["skin-hair", "anti-aging"],
        "duration_min": 7, "duration_max": 14,
        "price_usd": 105, "price_inr": 8000,
        "includes_accommodation": True, "includes_meals": True,
        "description": "Takradhara, Lepa, herbal facials and internal medicines for radiant skin "
                       "and hair health.",
    },
    {
        "name": "Digestive Health Reset",
        "type": "therapeutic",
        "categories": ["digestive-health", "detox-cleanse"],
        "duration_min": 7, "duration_max": 14,
        "price_usd": 100, "price_inr": 8000,
        "includes_accommodation": True, "includes_meals": True,
        "description": "Basti, Virechana, and Deepana therapies combined with Ayurvedic diet counselling "
                       "for IBS, acidity, and chronic digestive issues.",
    },
]

# Team member name pools
FIRST_NAMES = [
    "Dr. Krishnan", "Dr. Lakshmi", "Dr. Gopinath", "Dr. Jayalakshmi",
    "Dr. Rajeev", "Dr. Sreelatha", "Dr. Suresh", "Dr. Asha",
    "Dr. Mohan", "Dr. Deepa", "Dr. Anil", "Dr. Priya",
    "Dr. Rajan", "Dr. Meera", "Dr. Vinod", "Dr. Geetha",
    "Dr. Manoj", "Dr. Rema", "Dr. Prasad", "Dr. Sindhu",
    "Dr. Haridas", "Dr. Savitha", "Dr. Unnikrishnan", "Dr. Bindu",
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
    "The setting is breathtaking and the doctors genuinely knowledgeable. Worth every penny.",
    "I've done wellness retreats in Bali and Thailand — this is on a completely different level.",
    "As a Gulf NRI, this was exactly what I needed. Malayalam-speaking staff made me feel at home.",
    "The herbal medicines are prepared on-site — you can actually see the quality difference.",
    "Booked for stress relief, stayed for the complete transformation. 10/10.",
]

PATIENT_LOCATIONS = [
    "Dubai, UAE", "Abu Dhabi, UAE", "London, UK", "Berlin, Germany",
    "Amsterdam, Netherlands", "Munich, Germany", "Doha, Qatar",
    "Kuwait City, Kuwait", "Kochi, India", "Mumbai, India",
    "Bangalore, India", "Chennai, India", "Delhi, India",
    "Sharjah, UAE", "Riyadh, Saudi Arabia", "Manchester, UK",
    "Frankfurt, Germany", "Paris, France", "Toronto, Canada",
]

# ── Seed functions ────────────────────────────────────────────────────────────

def _slug(name: str, district: str) -> str:
    return (name.lower()
            .replace(' ', '-')
            .replace('.', '')
            .replace(',', '')
            .replace("'", '')) + '-' + district.lower().replace(' ', '-')


def seed_clinics(session: Session) -> list:
    existing = session.execute(text("SELECT COUNT(*) FROM clinic_feature_store")).scalar()
    if existing and existing >= 50:
        print(f"  ✓ {existing} retreats already exist, skipping")
        return list(session.execute(text("SELECT id FROM clinic_feature_store")).scalars().all())

    clinic_ids = []

    # ── Tier 2: 15 named authentic retreats ──────────────────────────────────
    for i, r in enumerate(TIER2_RETREATS):
        d = next((x for x in DISTRICTS if x["name"] == r["district"]), DISTRICTS[i % len(DISTRICTS)])
        slug = _slug(r["name"], r["district"])
        specs = RNG.sample(ALL_SPECIALISATIONS, RNG.randint(5, 9))
        langs = ["en", "ml"] + RNG.sample(["hi", "ar", "de", "fr"], RNG.randint(1, 3))

        cid = uuid.uuid4()
        clinic = ClinicFeatureStore(
            id=cid,
            slug=slug,
            name=r["name"],
            tier=2,
            district=r["district"],
            lat=d["lat"] + RNG.uniform(-0.05, 0.05),
            lng=d["lng"] + RNG.uniform(-0.05, 0.05),
            specialisations=specs,
            wellness_categories=r["categories"],
            languages=langs,
            pricing_min=RNG.choice([100, 120, 150, 180]),
            pricing_max=RNG.choice([200, 250, 300, 350]),
            certifications=r["certs"],
            accommodation_available=True,
            outcome_enrolled=True,
            is_active=True,
            rating=r["rating"],
            review_count=r["reviews"],
            description_en=r["desc"],
            address=f"{r['district']} District, Kerala, India",
            phone=f"+91 {RNG.randint(7000, 9999)} {RNG.randint(100000, 999999)}",
            email=f"info@{slug.split('-')[0]}.com",
            photos=[photo_url(slug), photo_url(slug + '-2'), photo_url(slug + '-3')],
        )
        session.add(clinic)
        clinic_ids.append(cid)

    # ── Tier 1: 35 verified retreats/clinics ─────────────────────────────────
    used_names: set = set()
    for i in range(35):
        prefix = CLINIC_PREFIXES[i % len(CLINIC_PREFIXES)]
        suffix = RETREAT_SUFFIXES[i % len(RETREAT_SUFFIXES)]
        name = f"{prefix} {suffix}"
        while name in used_names:
            prefix = RNG.choice(CLINIC_PREFIXES)
            name = f"{prefix} {suffix}"
        used_names.add(name)

        d = DISTRICTS[(i + 2) % len(DISTRICTS)]
        slug = _slug(name, d["name"])
        specs = RNG.sample(ALL_SPECIALISATIONS, RNG.randint(4, 8))
        categories = RNG.sample(WELLNESS_CATEGORIES, RNG.randint(3, 6))
        langs = ["en", "ml"] + RNG.sample(["hi", "ar", "de", "fr"], RNG.randint(0, 2))
        certs = RNG.sample(CERTIFICATIONS, RNG.randint(1, 3))

        cid = uuid.uuid4()
        clinic = ClinicFeatureStore(
            id=cid,
            slug=slug,
            name=name,
            tier=1,
            district=d["name"],
            lat=d["lat"] + RNG.uniform(-0.1, 0.1),
            lng=d["lng"] + RNG.uniform(-0.1, 0.1),
            specialisations=specs,
            wellness_categories=categories,
            languages=langs,
            pricing_min=RNG.choice([60, 75, 90, 100]),
            pricing_max=RNG.choice([120, 150, 180, 200]),
            certifications=certs,
            accommodation_available=RNG.random() > 0.3,
            outcome_enrolled=False,
            is_active=True,
            rating=round(RNG.uniform(3.5, 4.8), 1),
            review_count=RNG.randint(5, 80),
            description_en=f"Welcome to {name}, an authentic Ayurvedic wellness retreat in {d['name']}, Kerala. "
                           f"We offer traditional treatments rooted in centuries-old heritage, "
                           f"delivered by experienced BAMS-qualified practitioners.",
            address=f"{d['name']} District, Kerala, India",
            phone=f"+91 {RNG.randint(7000, 9999)} {RNG.randint(100000, 999999)}",
            email=f"info@{prefix.lower().replace(' ', '')}-ayurveda.com",
            photos=[photo_url(slug), photo_url(slug + '-b')],
        )
        session.add(clinic)
        clinic_ids.append(cid)

    session.flush()
    print(f"  ✓ Seeded 50 retreats (15 Tier 2 Certified Authentic + 35 Tier 1 Verified)")
    return clinic_ids


def seed_team(session: Session, clinic_ids: list) -> None:
    existing = session.execute(text("SELECT COUNT(*) FROM clinic_team")).scalar()
    if existing and existing > 0:
        print(f"  ✓ {existing} team members already exist, skipping")
        return

    count = 0
    for cid in clinic_ids:
        num_members = RNG.randint(2, 5)
        used_names: set = set()
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
                bio_en=f"{name} is an experienced Ayurvedic practitioner specialising in "
                       f"Panchakarma and traditional Kerala therapies.",
                display_order=j,
                is_active=True,
            )
            session.add(member)
            count += 1

    session.flush()
    print(f"  ✓ Seeded {count} team members across {len(clinic_ids)} retreats")


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
    print(f"  ✓ Seeded {len(package_ids)} packages across {len(clinic_ids)} retreats")
    return package_ids


def seed_availability(session: Session, package_ids: list) -> None:
    existing = session.execute(text("SELECT COUNT(*) FROM package_availability")).scalar()
    if existing and existing > 0:
        print(f"  ✓ {existing} availability records already exist, skipping")
        return

    today = date.today()
    count = 0
    for pid in package_ids:
        for day_offset in range(90):
            d = today + timedelta(days=day_offset)
            is_blocked = RNG.random() < 0.05
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
        patient = PatientProfile(
            pseudo_id=pid,
            language=lang,
        )
        session.add(patient)
        pseudo_ids.append(pid)

    session.flush()
    print(f"  ✓ Seeded {count} patient profiles")
    return pseudo_ids


def seed_bookings(
    session: Session,
    clinic_ids: list,
    package_ids: list,
    pseudo_ids: list,
    count: int = 300,
) -> list:
    existing = session.execute(text("SELECT COUNT(*) FROM bookings")).scalar()
    if existing and existing >= count:
        print(f"  ✓ {existing} bookings already exist, skipping")
        return list(session.execute(text("SELECT id FROM bookings")).scalars().all())

    booking_ids = []
    statuses = ["completed", "completed", "completed", "confirmed", "confirmed", "pending", "cancelled"]

    for i in range(count):
        cid = RNG.choice(clinic_ids)
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


def seed_reviews(
    session: Session,
    clinic_ids: list,
    booking_ids: list,
    pseudo_ids: list,
    count: int = 200,
) -> None:
    existing = session.execute(text("SELECT COUNT(*) FROM reviews")).scalar()
    if existing and existing >= count:
        print(f"  ✓ {existing} reviews already exist, skipping")
        return

    used_bookings: set = set()
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
    print("  Resetting seed data...")
    # Must delete in FK-safe order: children before parents
    session.execute(text("DELETE FROM reviews"))
    session.execute(text("DELETE FROM bookings"))
    session.execute(text("DELETE FROM patient_profiles WHERE pseudo_id LIKE 'seed-patient-%'"))
    session.execute(text("DELETE FROM package_availability"))
    session.execute(text("DELETE FROM wellness_packages"))
    session.execute(text("DELETE FROM clinic_team"))
    # Null out clinic FK on users rather than deleting user accounts
    session.execute(text("UPDATE users SET clinic_id = NULL WHERE clinic_id IS NOT NULL"))
    session.execute(text("DELETE FROM clinic_feature_store"))
    session.commit()
    print("  ✓ Reset complete")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed AyuRetreats development database")
    parser.add_argument("--reset", action="store_true", help="Wipe seed data before re-seeding")
    args = parser.parse_args()

    print("🌱 AyuRetreats seed script")
    print(f"  DB: {DATABASE_SYNC_URL.split('@')[-1]}")

    with Session(engine) as session:
        if args.reset:
            reset_seed_data(session)

        clinic_ids = seed_clinics(session)
        seed_team(session, clinic_ids)
        package_ids = seed_packages(session, clinic_ids)
        seed_availability(session, package_ids)
        pseudo_ids = seed_patients(session, count=200)
        booking_ids = seed_bookings(session, clinic_ids, package_ids, pseudo_ids, count=300)
        seed_reviews(session, clinic_ids, booking_ids, pseudo_ids, count=200)

        session.commit()
        print("\n✅ Seed complete — 50 retreats, 200 patients, 300 bookings, 200 reviews")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
scripts/seed.py — Seed realistic development data for Vaidya.

Run from project root:
    python scripts/seed.py            # seed (skip if data exists)
    python scripts/seed.py --reset    # drop seed data and re-seed

Reads DATABASE_SYNC_URL from .env.local (project root).
"""
import argparse
import os
import sys
import uuid
from pathlib import Path

import yaml

# ── Path setup ────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

# Load .env.local before importing models (models may read env at import time)
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
    ClinicFeatureStore,
    ConditionMap,
    Doctor,
    Treatment,
)

# ── Database connection ────────────────────────────────────────────────────────
DATABASE_SYNC_URL = os.environ.get(
    "DATABASE_SYNC_URL",
    "postgresql://vaidya:vaidya_dev@localhost:5432/vaidya",
)
# Docker internal host → localhost when running the script on the host machine
DATABASE_SYNC_URL = DATABASE_SYNC_URL.replace("@postgres:", "@localhost:")

engine = create_engine(DATABASE_SYNC_URL, echo=False)


# ── Clinic data ───────────────────────────────────────────────────────────────
CLINICS = [
    {
        "slug": "somatheeram-ayurveda-village",
        "name": "Somatheeram Ayurveda Village",
        "tier": 2,
        "district": "Thiruvananthapuram",
        "lat": 8.3725,
        "lng": 76.9768,
        "specialisations": ["panchakarma", "shirodhara", "pizhichil", "chronic-pain", "rejuvenation"],
        "prakriti_affinities": ["vata", "pitta", "vata-pitta"],
        "languages": ["en", "ar", "de", "fr"],
        "pricing_min": 95,
        "pricing_max": 180,
        "certifications": ["AYUSH", "NABH", "ISO-9001", "Kerala-Tourism-Green-Leaf"],
        "outcome_enrolled": True,
        "accommodation_available": True,
        "address": "Chowara Beach, Kovalam, Thiruvananthapuram, Kerala 695 501, India",
        "transport_info": "45 min from Trivandrum International Airport (TRV). Pickup arranged.",
        "rating": 4.8,
        "review_count": 312,
        "photos": [
            "https://placehold.co/800x500?text=Somatheeram+Main",
            "https://placehold.co/800x500?text=Somatheeram+Treatment",
            "https://placehold.co/800x500?text=Somatheeram+Garden",
        ],
    },
    {
        "slug": "arya-vaidya-sala-kottakkal",
        "name": "Arya Vaidya Sala Kottakkal",
        "tier": 2,
        "district": "Malappuram",
        "lat": 11.0164,
        "lng": 76.0035,
        "specialisations": [
            "classical-ayurveda",
            "panchakarma",
            "womens-health",
            "metabolic-disorders",
            "rasayana",
        ],
        "prakriti_affinities": ["vata", "pitta", "kapha", "vata-pitta", "pitta-kapha", "tridosha"],
        "languages": ["en", "ar", "ml", "hi"],
        "pricing_min": 70,
        "pricing_max": 140,
        "certifications": ["AYUSH", "NABH", "GMP", "ISO-9001"],
        "outcome_enrolled": True,
        "accommodation_available": True,
        "address": "Kottakkal, Malappuram District, Kerala 676 503, India",
        "transport_info": "30 min from Calicut International Airport (CCJ). Regular bus service from Malappuram.",
        "rating": 4.9,
        "review_count": 587,
        "photos": [
            "https://placehold.co/800x500?text=AVS+Kottakkal+Main",
            "https://placehold.co/800x500?text=AVS+Treatment+Hall",
            "https://placehold.co/800x500?text=AVS+Medicine+Garden",
        ],
    },
    {
        "slug": "mekosha-retreat-kannur",
        "name": "Mekosha Retreat",
        "tier": 1,
        "district": "Kannur",
        "lat": 11.8745,
        "lng": 75.3704,
        "specialisations": ["stress-management", "digestive-health", "weight-management", "wellness"],
        "prakriti_affinities": ["pitta", "kapha", "pitta-kapha"],
        "languages": ["en", "de"],
        "pricing_min": 120,
        "pricing_max": 200,
        "certifications": ["AYUSH", "Kerala-Tourism-Green-Leaf"],
        "outcome_enrolled": False,
        "accommodation_available": True,
        "address": "Thottada Beach Road, Kannur, Kerala 670 007, India",
        "transport_info": "20 min from Kannur International Airport (CNN). Hotel transfer available.",
        "rating": 4.6,
        "review_count": 94,
        "photos": [
            "https://placehold.co/800x500?text=Mekosha+Beachfront",
            "https://placehold.co/800x500?text=Mekosha+Treatment",
        ],
    },
]


# ── Doctor data (clinic referenced by slug, resolved at insert time) ──────────
DOCTORS = [
    {
        "slug": "dr-suresh-krishnan-somatheeram",
        "name": "Dr. Suresh Krishnan",
        "qualification": "BAMS, MD (Panchakarma)",
        "years_exp": 24,
        "clinic_slug": "somatheeram-ayurveda-village",
        "specialisations": ["panchakarma", "chronic-pain", "neurological-disorders", "pizhichil"],
        "prakriti_affinities": ["vata", "pitta"],
        "languages": ["en", "ar", "ml"],
        "tier": 2,
        "bio": (
            "Dr. Suresh Krishnan completed his BAMS from Government Ayurveda College, "
            "Thiruvananthapuram, and his MD in Panchakarma from Kerala University of Health Sciences. "
            "With 24 years of clinical experience specialising in Panchakarma detoxification and "
            "chronic musculoskeletal conditions, he has treated patients from over 40 countries at "
            "Somatheeram. His expertise in Pizhichil and Kati Basti for spinal disorders is widely "
            "recognised within the Kerala Ayurveda community."
        ),
        "patients_treated": 3200,
        "rating": 4.9,
        "review_count": 148,
        "pricing_per_day": 155,
    },
    {
        "slug": "dr-meera-nambiar-avs-kottakkal",
        "name": "Dr. Meera Nambiar",
        "qualification": "BAMS, MD (Panchakarma)",
        "years_exp": 18,
        "clinic_slug": "arya-vaidya-sala-kottakkal",
        "specialisations": ["womens-health", "fertility", "panchakarma", "rasayana"],
        "prakriti_affinities": ["kapha", "pitta"],
        "languages": ["en", "de", "ml"],
        "tier": 2,
        "bio": (
            "Dr. Meera Nambiar is a senior physician at Arya Vaidya Sala Kottakkal, specialising in "
            "Stri Roga (women's health) and Vandhyatva Chikitsa (fertility treatment). She holds her "
            "BAMS and MD in Panchakarma from Rajiv Gandhi University of Health Sciences and has "
            "18 years of clinical practice. Dr. Nambiar's individualised fertility protocols, "
            "integrating Uttara Basti with constitutional Rasayana therapy, have earned international "
            "recognition. She conducts regular consultations for patients from Germany and the UK."
        ),
        "patients_treated": 2100,
        "rating": 4.9,
        "review_count": 203,
        "pricing_per_day": 120,
    },
    {
        "slug": "dr-rajeev-varma-mekosha",
        "name": "Dr. Rajeev Varma",
        "qualification": "BAMS",
        "years_exp": 11,
        "clinic_slug": "mekosha-retreat-kannur",
        "specialisations": ["stress-management", "digestive-health", "shirodhara", "lifestyle-medicine"],
        "prakriti_affinities": ["pitta"],
        "languages": ["en", "ml", "hi"],
        "tier": 1,
        "bio": (
            "Dr. Rajeev Varma completed his BAMS from Amrita School of Ayurveda, Kochi, and brings "
            "11 years of clinical experience focused on stress-related disorders and digestive health. "
            "His integrative approach combines classical Shirodhara protocols with evidence-informed "
            "dietary counselling and yoga therapy. Dr. Varma has designed Mekosha's signature "
            "7-day Stress Recovery and 14-day Digestive Reset programmes, which attract primarily "
            "European guests seeking sustainable lifestyle interventions."
        ),
        "patients_treated": 980,
        "rating": 4.7,
        "review_count": 62,
        "pricing_per_day": 165,
    },
    {
        "slug": "dr-lakshmi-pillai-somatheeram",
        "name": "Dr. Lakshmi Pillai",
        "qualification": "BAMS, MD (Dravyaguna)",
        "years_exp": 15,
        "clinic_slug": "somatheeram-ayurveda-village",
        "specialisations": ["skin-conditions", "respiratory-disorders", "lepa", "takradhara"],
        "prakriti_affinities": ["kapha", "vata"],
        "languages": ["en", "ar"],
        "tier": 2,
        "bio": (
            "Dr. Lakshmi Pillai holds an MD in Dravyaguna (Ayurvedic pharmacognosy) from Gujarat "
            "Ayurved University and has practised at Somatheeram for 15 years. Her deep expertise "
            "in medicinal herbs enables highly personalised formulations for chronic skin diseases "
            "including psoriasis and eczema. She is particularly sought after by Gulf and "
            "Middle-Eastern patients for her Arabic language consultations and culturally sensitive "
            "approach. Her Takradhara and Lepa protocols for Kushtha (skin disease) are part of "
            "Somatheeram's certified treatment repertoire."
        ),
        "patients_treated": 1750,
        "rating": 4.8,
        "review_count": 112,
        "pricing_per_day": 145,
    },
    {
        "slug": "dr-arun-menon-avs-kottakkal",
        "name": "Dr. Arun Menon",
        "qualification": "BAMS",
        "years_exp": 8,
        "clinic_slug": "arya-vaidya-sala-kottakkal",
        "specialisations": ["weight-management", "metabolic-disorders", "udvartana", "panchakarma"],
        "prakriti_affinities": ["kapha"],
        "languages": ["en", "ml"],
        "tier": 1,
        "bio": (
            "Dr. Arun Menon completed his BAMS from Vaidyaratnam Ayurveda College, Thrissur, and "
            "joined Arya Vaidya Sala Kottakkal eight years ago. He has developed a strong clinical "
            "focus on metabolic syndrome, obesity, and diabetes (Prameha), using Udvartana, "
            "Virechana, and structured Kapha-pacifying dietary regimens. His patient population "
            "includes a significant proportion of NRI patients from the Gulf who return annually "
            "for seasonal Panchakarma maintenance."
        ),
        "patients_treated": 620,
        "rating": 4.6,
        "review_count": 41,
        "pricing_per_day": 95,
    },
]


# ── Treatment data (3 per clinic) ─────────────────────────────────────────────
# doctor_slug: primary doctor for this treatment
TREATMENTS = [
    # Somatheeram
    {
        "slug": "panchakarma-complete-somatheeram",
        "name": "Panchakarma Complete",
        "clinic_slug": "somatheeram-ayurveda-village",
        "doctor_slug": "dr-suresh-krishnan-somatheeram",
        "description": (
            "A full classical Panchakarma protocol comprising Poorvakarma (preparatory oleation and "
            "sudation), followed by one or more of the five main Shodhana procedures — Vamana, "
            "Virechana, Basti, Nasya, and Raktamokshana — selected based on the individual's "
            "Prakriti and Vikruti (current imbalance). Includes daily Abhyanga, Shirodhara on "
            "alternate days, and personalised post-treatment Rasayana support."
        ),
        "prakriti_tags": ["vata", "pitta", "vata-pitta"],
        "duration_min_days": 14,
        "duration_max_days": 21,
        "price_per_day": 150,
        "included_therapies": ["abhyanga", "shirodhara", "virechana", "basti", "nasya", "rasayana"],
    },
    {
        "slug": "shirodhara-retreat-somatheeram",
        "name": "Shirodhara Stress & Sleep Retreat",
        "clinic_slug": "somatheeram-ayurveda-village",
        "doctor_slug": "dr-suresh-krishnan-somatheeram",
        "description": (
            "An immersive retreat centred on Shirodhara — the continuous, rhythmic pouring of warm "
            "medicated oil over the forehead — combined with full-body Abhyanga, Shiro Abhyanga, "
            "and Pada Abhyanga. Indicated for insomnia, anxiety, hypertension, and Vata–Pitta "
            "nervous system imbalances. The programme includes dietary guidance and daily pranayama."
        ),
        "prakriti_tags": ["vata", "pitta", "vata-pitta", "kapha"],
        "duration_min_days": 7,
        "duration_max_days": 14,
        "price_per_day": 120,
        "included_therapies": ["shirodhara", "abhyanga", "shiro-abhyanga", "pada-abhyanga"],
    },
    {
        "slug": "pizhichil-kizhi-somatheeram",
        "name": "Pizhichil & Kizhi Pain Relief",
        "clinic_slug": "somatheeram-ayurveda-village",
        "doctor_slug": "dr-lakshmi-pillai-somatheeram",
        "description": (
            "A targeted musculoskeletal programme combining Pizhichil (continuous warm oil bath "
            "applied by two therapists simultaneously) with Kizhi (herbal bolus application), "
            "plus Kati Basti for lumbosacral conditions and Janu Basti for knee joint disorders. "
            "Highly effective for arthritis, spondylosis, back pain, and post-injury rehabilitation. "
            "Includes pre-treatment Snehapana (internal oleation) for maximum benefit."
        ),
        "prakriti_tags": ["vata", "kapha"],
        "duration_min_days": 7,
        "duration_max_days": 14,
        "price_per_day": 130,
        "included_therapies": ["pizhichil", "kizhi", "kati-basti", "janu-basti", "abhyanga"],
    },

    # Arya Vaidya Sala Kottakkal
    {
        "slug": "classical-panchakarma-avs",
        "name": "Classical Panchakarma (AVS Protocol)",
        "clinic_slug": "arya-vaidya-sala-kottakkal",
        "doctor_slug": "dr-meera-nambiar-avs-kottakkal",
        "description": (
            "Arya Vaidya Sala's gold-standard Panchakarma follows the canonical Ashtanga Hridayam "
            "protocols, using only in-house GMP-manufactured medicines. The extended 21–28 day "
            "format allows complete Poorvakarma preparation before Pradhanakarma (main procedures), "
            "ensuring deep-tissue Ama elimination. Includes a detailed pre-arrival Prakriti "
            "consultation, in-patient monitoring, and a structured 6-week post-treatment protocol."
        ),
        "prakriti_tags": ["vata", "pitta", "kapha", "tridosha"],
        "duration_min_days": 21,
        "duration_max_days": 28,
        "price_per_day": 110,
        "included_therapies": [
            "abhyanga",
            "swedana",
            "vamana",
            "virechana",
            "basti",
            "nasya",
            "rasayana",
        ],
    },
    {
        "slug": "fertility-womens-health-avs",
        "name": "Fertility & Women's Health Programme",
        "clinic_slug": "arya-vaidya-sala-kottakkal",
        "doctor_slug": "dr-meera-nambiar-avs-kottakkal",
        "description": (
            "A deeply personalised programme for women seeking support with fertility, PCOS, "
            "menstrual irregularities, and peri-menopausal symptoms. Combines Uttara Basti with "
            "medicated oils selected to the individual's Prakriti, Rasayana herbs to strengthen "
            "Shukra and Artava Dhatus, Virechana to clear Pitta–Rakta Dushti, and customised "
            "dietary and lifestyle counselling. Partner consultations available."
        ),
        "prakriti_tags": ["kapha", "pitta"],
        "duration_min_days": 14,
        "duration_max_days": 21,
        "price_per_day": 100,
        "included_therapies": [
            "uttara-basti",
            "rasayana",
            "virechana",
            "abhyanga",
            "shirodhara",
        ],
    },
    {
        "slug": "weight-metabolism-avs",
        "name": "Weight & Metabolic Reset",
        "clinic_slug": "arya-vaidya-sala-kottakkal",
        "doctor_slug": "dr-arun-menon-avs-kottakkal",
        "description": (
            "A medically supervised weight management programme grounded in Kapha-pacifying "
            "Ayurveda. The core protocol includes Udvartana (vigorous dry herbal powder massage) "
            "daily, Virechana for metabolic reset, and Deepana-Pachana herbs to rekindle Agni. "
            "Structured around a calorie-appropriate Kapha-reducing diet, graduated daily yoga, "
            "and weekly physician reviews. Particularly effective for patients with metabolic "
            "syndrome, type-2 diabetes, or insulin resistance."
        ),
        "prakriti_tags": ["kapha"],
        "duration_min_days": 14,
        "duration_max_days": 21,
        "price_per_day": 90,
        "included_therapies": ["udvartana", "virechana", "deepana-pachana", "swedana"],
    },

    # Mekosha Retreat
    {
        "slug": "stress-sleep-recovery-mekosha",
        "name": "Stress & Sleep Recovery",
        "clinic_slug": "mekosha-retreat-kannur",
        "doctor_slug": "dr-rajeev-varma-mekosha",
        "description": (
            "Mekosha's signature retreat for professionals experiencing burnout, chronic stress, "
            "and sleep disruption. The daily protocol includes Shirodhara, full-body Abhyanga, "
            "Shiro Abhyanga, and Pada Abhyanga, sequenced to progressively deepen the "
            "parasympathetic response over 7–10 days. Supported by morning pranayama, evening "
            "yoga nidra, and a customised sattvic diet. Includes a telehealth follow-up at day 30."
        ),
        "prakriti_tags": ["vata", "pitta"],
        "duration_min_days": 7,
        "duration_max_days": 10,
        "price_per_day": 160,
        "included_therapies": [
            "shirodhara",
            "abhyanga",
            "shiro-abhyanga",
            "pada-abhyanga",
            "nasya",
        ],
    },
    {
        "slug": "digestive-reset-mekosha",
        "name": "Digestive Reset Programme",
        "clinic_slug": "mekosha-retreat-kannur",
        "doctor_slug": "dr-rajeev-varma-mekosha",
        "description": (
            "A structured 10–14 day programme for chronic digestive disorders including IBS, "
            "acid reflux, bloating, and irregular bowel function. Combines Virechana (controlled "
            "Pitta elimination), Basti (colonic Vata regulation), and Deepana-Pachana herbs with "
            "a strict Agni-rekindling diet. Daily Abhyanga and Nasya support the systemic "
            "detoxification process. Programme includes pre-arrival dietary preparation guidelines."
        ),
        "prakriti_tags": ["pitta", "kapha"],
        "duration_min_days": 10,
        "duration_max_days": 14,
        "price_per_day": 140,
        "included_therapies": ["virechana", "basti", "deepana-pachana", "abhyanga", "nasya"],
    },
    {
        "slug": "wellness-immersion-mekosha",
        "name": "Wellness Immersion",
        "clinic_slug": "mekosha-retreat-kannur",
        "doctor_slug": "dr-rajeev-varma-mekosha",
        "description": (
            "A flexible wellness entry programme ideal for first-time Ayurveda guests or those "
            "with no specific clinical complaint. Includes a full Prakriti assessment with Dr. "
            "Varma, daily Abhyanga, a Shirodhara session, Nasya, and personalised dietary and "
            "lifestyle recommendations. The programme closes with a written Ayurvedic health "
            "plan and supplement protocol the guest can follow at home."
        ),
        "prakriti_tags": ["vata", "pitta", "kapha"],
        "duration_min_days": 5,
        "duration_max_days": 7,
        "price_per_day": 180,
        "included_therapies": ["abhyanga", "shirodhara", "nasya"],
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_conditions() -> list[dict]:
    conditions_path = ROOT / "config" / "conditions.yaml"
    data = yaml.safe_load(conditions_path.read_text())
    return data["conditions"]


def reset_seed_data(session: Session) -> None:
    """Delete only the tables seeded here, in FK-safe order."""
    print("  Deleting existing seed data...")
    session.execute(text("DELETE FROM treatments"))
    session.execute(text("DELETE FROM doctors"))
    session.execute(text("DELETE FROM clinic_feature_store"))
    session.execute(text("DELETE FROM conditions_map"))
    session.commit()
    print("  Existing seed data cleared.")


def seed(session: Session) -> None:
    # ── 1. Clinics ────────────────────────────────────────────────────────────
    print("\n[1/4] Seeding clinics...")
    clinic_map: dict[str, ClinicFeatureStore] = {}

    for c in CLINICS:
        existing = session.query(ClinicFeatureStore).filter_by(slug=c["slug"]).first()
        if existing:
            clinic_map[c["slug"]] = existing
            print(f"  ✓ (exists) {c['name']}")
            continue

        clinic = ClinicFeatureStore(
            id=uuid.uuid4(),
            slug=c["slug"],
            name=c["name"],
            tier=c["tier"],
            district=c["district"],
            lat=c["lat"],
            lng=c["lng"],
            specialisations=c["specialisations"],
            prakriti_affinities=c["prakriti_affinities"],
            languages=c["languages"],
            pricing_min=c["pricing_min"],
            pricing_max=c["pricing_max"],
            certifications=c["certifications"],
            outcome_enrolled=c["outcome_enrolled"],
            accommodation_available=c["accommodation_available"],
            address=c["address"],
            transport_info=c["transport_info"],
            rating=c["rating"],
            review_count=c["review_count"],
            photos=c["photos"],
            is_active=True,
        )
        session.add(clinic)
        session.flush()
        clinic_map[c["slug"]] = clinic
        print(f"  + {c['name']} (Tier {c['tier']})")

    session.commit()

    # ── 2. Doctors ────────────────────────────────────────────────────────────
    print("\n[2/4] Seeding doctors...")
    doctor_map: dict[str, Doctor] = {}

    for d in DOCTORS:
        existing = session.query(Doctor).filter_by(slug=d["slug"]).first()
        if existing:
            doctor_map[d["slug"]] = existing
            print(f"  ✓ (exists) {d['name']}")
            continue

        clinic = clinic_map[d["clinic_slug"]]
        doctor = Doctor(
            id=uuid.uuid4(),
            slug=d["slug"],
            name=d["name"],
            qualification=d["qualification"],
            years_exp=d["years_exp"],
            clinic_id=clinic.id,
            specialisations=d["specialisations"],
            prakriti_affinities=d["prakriti_affinities"],
            languages=d["languages"],
            bio=d["bio"],
            tier=d["tier"],
            patients_treated=d["patients_treated"],
            rating=d["rating"],
            review_count=d["review_count"],
            pricing_per_day=d["pricing_per_day"],
            is_active=True,
        )
        session.add(doctor)
        session.flush()
        doctor_map[d["slug"]] = doctor
        print(f"  + {d['name']} → {d['clinic_slug']} (Tier {d['tier']})")

    session.commit()

    # ── 3. Treatments ─────────────────────────────────────────────────────────
    print("\n[3/4] Seeding treatments...")

    for t in TREATMENTS:
        existing = session.query(Treatment).filter_by(slug=t["slug"]).first()
        if existing:
            print(f"  ✓ (exists) {t['name']}")
            continue

        clinic = clinic_map[t["clinic_slug"]]
        doctor = doctor_map[t["doctor_slug"]]
        treatment = Treatment(
            id=uuid.uuid4(),
            slug=t["slug"],
            name=t["name"],
            description=t["description"],
            prakriti_tags=t["prakriti_tags"],
            duration_min_days=t["duration_min_days"],
            duration_max_days=t["duration_max_days"],
            price_per_day=t["price_per_day"],
            included_therapies=t["included_therapies"],
            clinic_id=clinic.id,
            doctor_id=doctor.id,
            is_active=True,
        )
        session.add(treatment)
        print(f"  + {t['name']} ({t['duration_min_days']}–{t['duration_max_days']} days, ${t['price_per_day']}/day)")

    session.commit()

    # ── 4. Conditions map ─────────────────────────────────────────────────────
    print("\n[4/4] Seeding conditions map...")
    conditions = load_conditions()

    for cond in conditions:
        existing = session.query(ConditionMap).filter_by(condition_slug=cond["condition_slug"]).first()
        if existing:
            print(f"  ✓ (exists) {cond['condition_name']}")
            continue

        condition = ConditionMap(
            id=uuid.uuid4(),
            condition_slug=cond["condition_slug"],
            condition_name=cond["condition_name"],
            condition_name_ar=cond.get("condition_name_ar"),
            condition_name_ml=cond.get("condition_name_ml"),
            treatment_slugs=cond.get("treatment_slugs", []),
        )
        session.add(condition)
        print(f"  + {cond['condition_name']} ({len(cond.get('treatment_slugs', []))} treatments)")

    session.commit()


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Vaidya development data")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete all existing seed data before re-seeding",
    )
    args = parser.parse_args()

    print(f"Connecting to: {DATABASE_SYNC_URL.split('@')[-1]}")

    with Session(engine) as session:
        if args.reset:
            print("\n[--reset] Dropping existing seed data...")
            reset_seed_data(session)

        seed(session)

    print("\nDone. Seed complete.")
    print(f"  Clinics : {len(CLINICS)}")
    print(f"  Doctors : {len(DOCTORS)}")
    print(f"  Treatments: {len(TREATMENTS)}")


if __name__ == "__main__":
    main()

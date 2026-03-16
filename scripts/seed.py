#!/usr/bin/env python3
"""
scripts/seed.py — Full development seed: 50 clinics, doctors, treatments,
products, variants, patients, bookings and reviews.

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

import yaml

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
    ClinicFeatureStore,
    ConditionMap,
    Doctor,
    DoctorTreatment,
    OrderItem,
    PatientProfile,
    Product,
    ProductOrder,
    ProductVariant,
    Review,
    Treatment,
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
    "chronic-pain", "rejuvenation", "rasayana", "womens-health", "fertility",
    "skin-conditions", "respiratory-disorders", "stress-management",
    "digestive-health", "weight-management", "neurological-disorders",
    "metabolic-disorders", "classical-ayurveda", "sports-injuries",
    "lifestyle-medicine", "geriatric-care", "paediatric-ayurveda",
    "cardiac-care", "diabetes-management",
]

PRAKRITI_COMBOS = [
    ["vata"],
    ["pitta"],
    ["kapha"],
    ["vata", "pitta"],
    ["pitta", "kapha"],
    ["vata", "kapha"],
    ["vata", "pitta", "kapha"],
    ["vata", "pitta", "vata-pitta"],
    ["pitta", "kapha", "pitta-kapha"],
    ["vata", "kapha", "tridosha"],
]

CERT_POOL = ["AYUSH", "NABH", "GMP", "ISO-9001", "Kerala-Tourism-Green-Leaf", "NABH-Wellness", "JCI"]

LANGUAGE_COMBOS = [
    ["en"],
    ["en", "ml"],
    ["en", "ar"],
    ["en", "de"],
    ["en", "ml", "hi"],
    ["en", "ar", "ml"],
    ["en", "de", "fr"],
    ["en", "ar", "de", "fr"],
    ["en", "ml", "ar", "hi"],
]

# 8 anchor clinics (guaranteed in the seed, always first)
ANCHOR_CLINICS = [
    {
        "slug": "somatheeram-ayurveda-village",
        "name": "Somatheeram Ayurveda Village",
        "tier": 2, "district": "Thiruvananthapuram",
        "lat": 8.3725, "lng": 76.9768,
        "specialisations": ["panchakarma", "shirodhara", "pizhichil", "chronic-pain", "rejuvenation"],
        "prakriti_affinities": ["vata", "pitta", "vata-pitta"],
        "languages": ["en", "ar", "de", "fr"],
        "pricing_min": 95, "pricing_max": 180,
        "certifications": ["AYUSH", "NABH", "ISO-9001", "Kerala-Tourism-Green-Leaf"],
        "outcome_enrolled": True, "accommodation_available": True,
        "address": "Chowara Beach, Kovalam, Thiruvananthapuram, Kerala 695 501",
        "transport_info": "45 min from Trivandrum International Airport (TRV). Free pickup available.",
        "rating": 4.8, "review_count": 312,
        "photos": ["https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop"],
    },
    {
        "slug": "arya-vaidya-sala-kottakkal",
        "name": "Arya Vaidya Sala Kottakkal",
        "tier": 2, "district": "Malappuram",
        "lat": 11.0164, "lng": 76.0035,
        "specialisations": ["classical-ayurveda", "panchakarma", "womens-health", "metabolic-disorders", "rasayana"],
        "prakriti_affinities": ["vata", "pitta", "kapha", "vata-pitta", "pitta-kapha", "tridosha"],
        "languages": ["en", "ar", "ml", "hi"],
        "pricing_min": 70, "pricing_max": 140,
        "certifications": ["AYUSH", "NABH", "GMP", "ISO-9001"],
        "outcome_enrolled": True, "accommodation_available": True,
        "address": "Kottakkal, Malappuram District, Kerala 676 503",
        "transport_info": "30 min from Calicut International Airport (CCJ).",
        "rating": 4.9, "review_count": 587,
        "photos": ["https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop"],
    },
    {
        "slug": "vaidyaratnam-thrissur",
        "name": "Vaidyaratnam Ayurveda Hospital",
        "tier": 2, "district": "Thrissur",
        "lat": 10.5276, "lng": 76.2144,
        "specialisations": ["classical-ayurveda", "rasayana", "neurological-disorders", "geriatric-care", "panchakarma"],
        "prakriti_affinities": ["vata", "pitta", "kapha", "tridosha"],
        "languages": ["en", "ml", "ar"],
        "pricing_min": 80, "pricing_max": 160,
        "certifications": ["AYUSH", "GMP", "NABH"],
        "outcome_enrolled": True, "accommodation_available": True,
        "address": "Ollur, Thrissur, Kerala 680 306",
        "transport_info": "25 min from Cochin International Airport (COK). Daily shuttle service.",
        "rating": 4.8, "review_count": 241,
        "photos": ["https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop"],
    },
    {
        "slug": "kairali-ayurvedic-health-village",
        "name": "Kairali Ayurvedic Health Village",
        "tier": 2, "district": "Palakkad",
        "lat": 10.7867, "lng": 76.6548,
        "specialisations": ["panchakarma", "rejuvenation", "stress-management", "weight-management", "womens-health"],
        "prakriti_affinities": ["vata", "pitta", "vata-pitta", "pitta-kapha"],
        "languages": ["en", "ar", "de"],
        "pricing_min": 110, "pricing_max": 210,
        "certifications": ["AYUSH", "NABH", "Kerala-Tourism-Green-Leaf", "ISO-9001"],
        "outcome_enrolled": True, "accommodation_available": True,
        "address": "Perumanam, Kodumbu, Palakkad, Kerala 678 551",
        "transport_info": "90 min from Cochin International Airport (COK). Pickup arranged.",
        "rating": 4.7, "review_count": 178,
        "photos": ["https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1552693673-1bf958298935?w=800&auto=format&fit=crop"],
    },
    {
        "slug": "santhigiri-ashram-trivandrum",
        "name": "Santhigiri Ayurveda & Siddha Vaidyasala",
        "tier": 2, "district": "Thiruvananthapuram",
        "lat": 8.5241, "lng": 76.9366,
        "specialisations": ["classical-ayurveda", "chronic-pain", "skin-conditions", "respiratory-disorders", "diabetes-management"],
        "prakriti_affinities": ["vata", "pitta", "kapha", "pitta-kapha"],
        "languages": ["en", "ml", "ar", "hi"],
        "pricing_min": 60, "pricing_max": 120,
        "certifications": ["AYUSH", "GMP", "ISO-9001"],
        "outcome_enrolled": True, "accommodation_available": True,
        "address": "Pothencode, Thiruvananthapuram, Kerala 695 584",
        "transport_info": "35 min from Trivandrum International Airport (TRV).",
        "rating": 4.7, "review_count": 196,
        "photos": ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop"],
    },
    {
        "slug": "mekosha-retreat-kannur",
        "name": "Mekosha Ayurveda Retreat",
        "tier": 1, "district": "Kannur",
        "lat": 11.8745, "lng": 75.3704,
        "specialisations": ["stress-management", "digestive-health", "weight-management", "lifestyle-medicine"],
        "prakriti_affinities": ["pitta", "kapha", "pitta-kapha"],
        "languages": ["en", "de"],
        "pricing_min": 120, "pricing_max": 200,
        "certifications": ["AYUSH", "Kerala-Tourism-Green-Leaf"],
        "outcome_enrolled": False, "accommodation_available": True,
        "address": "Thottada Beach Road, Kannur, Kerala 670 007",
        "transport_info": "20 min from Kannur International Airport (CNN).",
        "rating": 4.6, "review_count": 94,
        "photos": ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1560472355-a3b4cee4b4cd?w=800&auto=format&fit=crop"],
    },
    {
        "slug": "amrita-ayurveda-ernakulam",
        "name": "Amrita School of Ayurveda",
        "tier": 2, "district": "Ernakulam",
        "lat": 9.9312, "lng": 76.2673,
        "specialisations": ["panchakarma", "cardiac-care", "neurological-disorders", "rasayana", "classical-ayurveda"],
        "prakriti_affinities": ["vata", "pitta", "vata-pitta", "tridosha"],
        "languages": ["en", "ml", "ar"],
        "pricing_min": 85, "pricing_max": 175,
        "certifications": ["AYUSH", "NABH", "JCI", "ISO-9001"],
        "outcome_enrolled": True, "accommodation_available": True,
        "address": "AIMS Ponekkara PO, Ernakulam, Kerala 682 041",
        "transport_info": "15 min from Cochin International Airport (COK).",
        "rating": 4.8, "review_count": 320,
        "photos": ["https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop"],
    },
    {
        "slug": "nirmala-ayurveda-kozhikode",
        "name": "Nirmala Ayurveda Retreat",
        "tier": 1, "district": "Kozhikode",
        "lat": 11.2588, "lng": 75.7804,
        "specialisations": ["rejuvenation", "shirodhara", "abhyanga", "stress-management", "skin-conditions"],
        "prakriti_affinities": ["vata", "pitta"],
        "languages": ["en", "ar", "ml"],
        "pricing_min": 90, "pricing_max": 150,
        "certifications": ["AYUSH", "Kerala-Tourism-Green-Leaf"],
        "outcome_enrolled": False, "accommodation_available": True,
        "address": "Beypore Road, Kozhikode, Kerala 673 015",
        "transport_info": "25 min from Calicut International Airport (CCJ).",
        "rating": 4.5, "review_count": 112,
        "photos": ["https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop"],
    },
]

# ── Doctor name pools ──────────────────────────────────────────────────────────

DOCTOR_FIRST_NAMES_M = [
    "Suresh", "Rajeev", "Arun", "Vishnu", "Prasad", "Rajesh", "Sujith", "Manoj",
    "Deepak", "Anoop", "Shibu", "Vinod", "Biju", "Rajan", "Babu", "Dinesh",
    "Sreejith", "Ajith", "Naveen", "Sreekanth", "Harikumar", "Madhavan",
    "Pradeep", "Jomon", "Bipin", "Joby", "Gibu", "Sajeev", "Noushad", "Arjun",
]
DOCTOR_FIRST_NAMES_F = [
    "Meera", "Lakshmi", "Priya", "Sindhu", "Asha", "Deepa", "Rekha", "Sreeja",
    "Nisha", "Divya", "Lekha", "Ambika", "Suja", "Bindu", "Hema", "Radha",
    "Santhimol", "Anila", "Beena", "Geeta", "Swapna", "Usha", "Vijaya", "Liji",
]
DOCTOR_LAST_NAMES = [
    "Krishnan", "Nambiar", "Varma", "Pillai", "Menon", "Nair", "Panicker",
    "Kurup", "Namboothiri", "Mohan", "Kumar", "Rajan", "Das", "George",
    "Mathew", "Thomas", "Paulose", "Philip", "Antony", "Joseph", "Simon",
    "Iyer", "Sharma", "Patel", "Rao", "Thampi", "Warrier", "Pisharody",
]

QUALIFICATIONS = [
    "BAMS", "BAMS", "BAMS",                          # most common
    "BAMS, MD (Panchakarma)",
    "BAMS, MD (Kayachikitsa)",
    "BAMS, MD (Dravyaguna)",
    "BAMS, MD (Prasuti Tantra)",
    "BAMS, PhD",
    "MD (Ayurveda)",
]

# ── Treatment vocabulary ───────────────────────────────────────────────────────

TREATMENT_TEMPLATES = [
    {
        "name": "Panchakarma Complete",
        "slug_suffix": "panchakarma",
        "description": "A full classical five-fold purification protocol tailored to the patient's Prakriti and current Vikruti. Includes Abhyanga, Shirodhara, and the indicated Shodhana procedure.",
        "prakriti_tags": ["vata", "pitta", "kapha"],
        "duration_min": 14, "duration_max": 21,
        "price_range": (100, 160),
        "therapies": ["abhyanga", "shirodhara", "virechana", "basti", "nasya", "rasayana"],
    },
    {
        "name": "Shirodhara Retreat",
        "slug_suffix": "shirodhara",
        "description": "Continuous warm medicated oil poured over the forehead to calm the nervous system. Indicated for insomnia, anxiety, hypertension, and Vata–Pitta imbalances.",
        "prakriti_tags": ["vata", "pitta", "vata-pitta"],
        "duration_min": 7, "duration_max": 14,
        "price_range": (90, 140),
        "therapies": ["shirodhara", "abhyanga", "shiro-abhyanga", "pada-abhyanga"],
    },
    {
        "name": "Pizhichil Pain Relief",
        "slug_suffix": "pizhichil",
        "description": "Warm medicated oil poured continuously over the entire body by two therapists. Deeply effective for arthritis, spondylosis, and musculoskeletal pain.",
        "prakriti_tags": ["vata", "kapha"],
        "duration_min": 7, "duration_max": 14,
        "price_range": (110, 155),
        "therapies": ["pizhichil", "kizhi", "kati-basti", "abhyanga"],
    },
    {
        "name": "Njavara Kizhi Rejuvenation",
        "slug_suffix": "njavara-kizhi",
        "description": "Bolus therapy using cooked Njavara (medicinal rice) tied in muslin and applied to the entire body after Abhyanga. Rebuilds Dhatus and reverses tissue depletion.",
        "prakriti_tags": ["vata", "pitta", "kapha"],
        "duration_min": 7, "duration_max": 14,
        "price_range": (95, 145),
        "therapies": ["njavara-kizhi", "abhyanga", "rasayana"],
    },
    {
        "name": "Fertility Programme",
        "slug_suffix": "fertility",
        "description": "A deeply personalised protocol combining Uttara Basti, Rasayana herbs to strengthen reproductive tissues, and Virechana to clear Pitta–Rakta Dushti.",
        "prakriti_tags": ["kapha", "pitta"],
        "duration_min": 14, "duration_max": 21,
        "price_range": (90, 130),
        "therapies": ["uttara-basti", "rasayana", "virechana", "abhyanga"],
    },
    {
        "name": "Weight & Metabolic Reset",
        "slug_suffix": "weight-reset",
        "description": "Kapha-pacifying Udvartana dry powder massage, Virechana for metabolic reset, and structured Agni-rekindling diet for obesity and metabolic syndrome.",
        "prakriti_tags": ["kapha"],
        "duration_min": 14, "duration_max": 21,
        "price_range": (80, 120),
        "therapies": ["udvartana", "virechana", "deepana-pachana", "swedana"],
    },
    {
        "name": "Skin Disease Programme",
        "slug_suffix": "skin",
        "description": "Takradhara with medicated buttermilk for Pitta-driven skin disorders, combined with herbal Lepa applications and Njavara Kizhi for tissue repair.",
        "prakriti_tags": ["pitta", "kapha"],
        "duration_min": 14, "duration_max": 21,
        "price_range": (85, 125),
        "therapies": ["takradhara", "lepa", "njavara-kizhi", "virechana"],
    },
    {
        "name": "Stress & Sleep Recovery",
        "slug_suffix": "stress",
        "description": "A 7–10 day burnout recovery combining Shirodhara, Abhyanga, and Pada Abhyanga with morning pranayama and sattvic diet.",
        "prakriti_tags": ["vata", "pitta"],
        "duration_min": 7, "duration_max": 10,
        "price_range": (130, 175),
        "therapies": ["shirodhara", "abhyanga", "shiro-abhyanga", "pada-abhyanga", "nasya"],
    },
    {
        "name": "Digestive Reset",
        "slug_suffix": "digestive",
        "description": "Virechana for Pitta elimination, Basti for colonic Vata regulation, and Deepana-Pachana herbs to rekindle Agni. Effective for IBS, bloating, and acid reflux.",
        "prakriti_tags": ["pitta", "kapha"],
        "duration_min": 10, "duration_max": 14,
        "price_range": (100, 140),
        "therapies": ["virechana", "basti", "deepana-pachana", "abhyanga"],
    },
    {
        "name": "Wellness Immersion",
        "slug_suffix": "wellness",
        "description": "Entry-level programme for first-time guests. Includes full Prakriti assessment, daily Abhyanga, Shirodhara, Nasya, and a written Ayurvedic health plan.",
        "prakriti_tags": ["vata", "pitta", "kapha"],
        "duration_min": 5, "duration_max": 7,
        "price_range": (120, 180),
        "therapies": ["abhyanga", "shirodhara", "nasya"],
    },
    {
        "name": "Rasayana Rejuvenation",
        "slug_suffix": "rasayana",
        "description": "Classical Rasayana protocol combining Njavara Kizhi, Shirodhara, and oral Rasayana formulations to rebuild Ojas and reverse age-related tissue depletion.",
        "prakriti_tags": ["vata", "pitta", "kapha"],
        "duration_min": 14, "duration_max": 28,
        "price_range": (100, 165),
        "therapies": ["njavara-kizhi", "shirodhara", "abhyanga", "rasayana", "nasya"],
    },
    {
        "name": "Cardiac Wellness Programme",
        "slug_suffix": "cardiac",
        "description": "A medically supervised programme for hypertension and cardiac risk factors. Takradhara, mild Virechana, and heart-tonic Rasayana formulations with yoga and diet.",
        "prakriti_tags": ["pitta", "vata-pitta"],
        "duration_min": 14, "duration_max": 21,
        "price_range": (110, 160),
        "therapies": ["takradhara", "shirodhara", "virechana", "abhyanga"],
    },
]

# ── Herbal product vocabulary ──────────────────────────────────────────────────

PRODUCT_TEMPLATES = [
    {"name": "Brahmi Ghrita",          "category": "ghee",      "prakriti": ["vata", "pitta"],  "base": 650,  "desc": "Clarified butter medicated with Brahmi. Enhances memory, cognition, and nervous system function."},
    {"name": "Ashwagandha Capsules",   "category": "capsules",  "prakriti": ["vata"],           "base": 480,  "desc": "Standardised Withania somnifera root extract for strength, stamina, and stress resilience."},
    {"name": "Triphala Churnam",       "category": "churnas",   "prakriti": ["tridosha"],       "base": 220,  "desc": "Three-fruit powder (Amalaki, Bibhitaki, Haritaki) for daily colon cleansing and antioxidant support."},
    {"name": "Chyawanprash",           "category": "lehyas",    "prakriti": ["vata", "kapha"],  "base": 390,  "desc": "Classical Rasayana jam with Amalaki base. Boosts immunity, lung function, and Ojas."},
    {"name": "Dhanwantaram Taila",     "category": "oils",      "prakriti": ["vata"],           "base": 540,  "desc": "Classical medicated sesame oil for Vata disorders, joint pain, and post-natal care."},
    {"name": "Neelibhringadi Taila",   "category": "oils",      "prakriti": ["pitta"],          "base": 420,  "desc": "Bhringraj and Neeli-infused hair oil for hair loss, premature greying, and scalp Pitta."},
    {"name": "Ksheerabala Taila",      "category": "oils",      "prakriti": ["vata", "pitta"],  "base": 580,  "desc": "Milk-processed Bala root oil for neurological disorders, facial palsy, and musculoskeletal pain."},
    {"name": "Kumkumadi Tailam",       "category": "oils",      "prakriti": ["pitta"],          "base": 890,  "desc": "Saffron and 25-herb face oil for complexion brightening, pigmentation, and skin lustre."},
    {"name": "Nalpamara Kuzhambu",     "category": "external",  "prakriti": ["pitta", "kapha"], "base": 310,  "desc": "Bark extract paste for chronic skin conditions, wounds, and fungal infections."},
    {"name": "Trikatu Churnam",        "category": "churnas",   "prakriti": ["kapha"],          "base": 180,  "desc": "Ginger, Black pepper, Pippali blend to rekindle Agni and clear Ama from respiratory channels."},
    {"name": "Saraswatarishta",        "category": "decoctions","prakriti": ["vata", "pitta"],  "base": 340,  "desc": "Brahmi-based fermented formulation for memory enhancement, anxiety, and speech disorders."},
    {"name": "Dasamoolarishtam",       "category": "decoctions","prakriti": ["vata"],           "base": 290,  "desc": "Ten-root fermented tonic for post-natal recovery, respiratory weakness, and Vata depletion."},
    {"name": "Draksharishta",          "category": "decoctions","prakriti": ["pitta", "kapha"], "base": 260,  "desc": "Grape-based fermented tonic for anaemia, liver health, and general debility."},
    {"name": "Balaswagandhadi Taila",  "category": "oils",      "prakriti": ["vata"],           "base": 510,  "desc": "Bala and Ashwagandha oil for musculoskeletal depletion, growth disorders, and Vata aggravation."},
    {"name": "Pinda Tailam",           "category": "oils",      "prakriti": ["pitta"],          "base": 620,  "desc": "Camphor and herb-infused oil for inflammatory skin conditions, burns, and allergic reactions."},
    {"name": "Chandanadi Tailam",      "category": "oils",      "prakriti": ["pitta"],          "base": 450,  "desc": "Sandalwood-based cooling oil for sunburn, skin rashes, and Pitta-type headaches."},
    {"name": "Gulgulutiktam Kashayam", "category": "decoctions","prakriti": ["kapha", "pitta"], "base": 310,  "desc": "Classical decoction for skin diseases, bone disorders, and chronic inflammatory conditions."},
    {"name": "Vidaryadi Ghritam",      "category": "ghee",      "prakriti": ["vata"],           "base": 720,  "desc": "Vidarikanda-processed ghee for reproductive health, underweight, and tissue building."},
    {"name": "Amla Churnam",           "category": "churnas",   "prakriti": ["pitta"],          "base": 160,  "desc": "Pure Amalaki powder — highest natural source of Vitamin C and potent Pitta pacifier."},
    {"name": "Indukantam Ghritam",     "category": "ghee",      "prakriti": ["vata", "pitta"],  "base": 680,  "desc": "Medicated ghee for digestive weakness, malabsorption, and Vata–Pitta imbalance."},
]

VARIANT_SIZES = {
    "oils":      [("100ml", 100), ("200ml", 200), ("450ml", 400)],
    "churnas":   [("100g",  100), ("250g",  200), ("500g",  350)],
    "capsules":  [("30 caps", 0), ("60 caps", 80), ("90 caps", 130)],
    "lehyas":    [("250g",  0),  ("500g",  180)],
    "ghee":      [("150g",  0),  ("300g",  280)],
    "decoctions":[("200ml", 0),  ("450ml", 170)],
    "external":  [("50g",   0),  ("100g",  90)],
}

# ── Image URL pools ───────────────────────────────────────────────────────────
# All Unsplash URLs are stable direct-access (no API key needed).
# Clinic/retreat photos — Kerala nature, spa, Ayurveda settings
CLINIC_PHOTO_URLS = [
    "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&auto=format&fit=crop",  # spa treatment room
    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop",  # wellness pool
    "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&auto=format&fit=crop",  # massage room
    "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop",  # ayurveda oils
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop",  # Kerala nature
    "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=800&auto=format&fit=crop",  # tropical river
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop",  # green hills
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&auto=format&fit=crop",  # yoga retreat
    "https://images.unsplash.com/photo-1552693673-1bf958298935?w=800&auto=format&fit=crop",  # herbal medicine
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop",  # resort exterior
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop",  # treatment
    "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop",  # spa candles
    "https://images.unsplash.com/photo-1560472355-a3b4cee4b4cd?w=800&auto=format&fit=crop",  # wellness
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",  # herbal food
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop",  # clinic interior
]

# Product photos — herbs, oils, Ayurvedic products
PRODUCT_PHOTO_URLS = {
    "oils":       "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&auto=format&fit=crop",
    "churnas":    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&auto=format&fit=crop",
    "capsules":   "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop",
    "decoctions": "https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=400&auto=format&fit=crop",
    "ghee":       "https://images.unsplash.com/photo-1631557939478-cfb0a6e84dae?w=400&auto=format&fit=crop",
    "lehyas":     "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&auto=format&fit=crop",
    "external":   "https://images.unsplash.com/photo-1604004555489-723a93d6ce74?w=400&auto=format&fit=crop",
}
PRODUCT_PHOTO_DEFAULT = "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&auto=format&fit=crop"

# Doctor portraits — randomuser.me (stable, real face photos, no auth required)
# 60 male + 40 female indices pre-assigned
DOCTOR_PHOTO_MALE   = [f"https://randomuser.me/api/portraits/men/{i}.jpg"   for i in range(1, 61)]
DOCTOR_PHOTO_FEMALE = [f"https://randomuser.me/api/portraits/women/{i}.jpg" for i in range(1, 41)]

# ── Review text pools ──────────────────────────────────────────────────────────

REVIEW_TEXTS = [
    "Truly transformative experience. The doctors here are deeply knowledgeable and genuinely care.",
    "I came with chronic back pain and left with 70% relief. The Kati Basti sessions were remarkable.",
    "A complete Panchakarma in 21 days. My digestion and energy have never been better. Highly recommended.",
    "The Shirodhara sessions were unlike anything I've experienced. Deep relaxation and clearer sleep within 3 days.",
    "Exceptional care and attention to detail. Every treatment was tailored to my specific constitution.",
    "I've tried several Ayurveda centres across Kerala. This is by far the most authentic and medically rigorous.",
    "Came for weight management. Lost 6kg in 14 days with the Udvartana protocol and felt healthier overall.",
    "My psoriasis has been in remission for 6 months after the Takradhara programme. Worth every penny.",
    "The doctors explained every treatment in detail. I felt fully informed and safe throughout.",
    "Post-retreat herbal products arrived well-packaged. The Brahmi Ghrita has become part of my daily routine.",
    "Wonderful facility with attentive staff. The skin treatment programme cleared conditions I'd had for years.",
    "Professional and authentic. Not a wellness resort masquerading as Ayurveda — the real deal.",
    "I was sceptical initially, but the clinical precision of the treatment programme was impressive.",
    "Fertility programme worked for us after two years of trying. Words cannot express our gratitude.",
    "Beautiful location, impeccable hygiene, and world-class doctors. Will return next year.",
    "The Rasayana rejuvenation programme reversed my fatigue completely. My energy at 55 is better than at 40.",
    "Came from Germany specifically for this clinic. The German-speaking consultation was a bonus.",
    "The dietary guidance was as valuable as the treatments. My Agni is completely reset.",
]

REVIEWER_LOCATIONS = [
    "Dubai, UAE", "Abu Dhabi, UAE", "Doha, Qatar", "Riyadh, Saudi Arabia",
    "London, UK", "Berlin, Germany", "Munich, Germany", "Amsterdam, Netherlands",
    "Toronto, Canada", "Melbourne, Australia", "Singapore", "New York, USA",
    "Paris, France", "Kuala Lumpur, Malaysia", "Kuwait City, Kuwait",
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    return text.lower().replace(" ", "-").replace("'", "").replace("(", "").replace(")", "").replace(",", "").replace("&", "and")


def generate_clinics(n_total: int = 50) -> list[dict]:
    """Return anchor clinics + procedurally generated clinics to reach n_total."""
    clinics = list(ANCHOR_CLINICS)
    used_names = {c["slug"] for c in clinics}
    district_cycle = DISTRICTS * 10  # enough to cycle through

    for i in range(n_total - len(ANCHOR_CLINICS)):
        district = RNG.choice(DISTRICTS)
        prefix   = RNG.choice(CLINIC_PREFIXES)
        suffix   = RNG.choice(CLINIC_SUFFIXES)
        name     = f"{prefix} {suffix}"
        slug     = f"{slugify(prefix)}-{slugify(suffix)}-{slugify(district['name'])}-{i+1}"

        tier = 2 if RNG.random() < 0.4 else 1

        specialisations = RNG.sample(ALL_SPECIALISATIONS, RNG.randint(3, 6))
        prakriti_affinities = RNG.choice(PRAKRITI_COMBOS)
        languages = RNG.choice(LANGUAGE_COMBOS)
        certs = ["AYUSH"] + RNG.sample([c for c in CERT_POOL if c != "AYUSH"], RNG.randint(1, 3 if tier == 2 else 2))
        pricing_min = RNG.randint(5, 14) * 10
        pricing_max = pricing_min + RNG.randint(3, 10) * 10
        lat = district["lat"] + RNG.uniform(-0.3, 0.3)
        lng = district["lng"] + RNG.uniform(-0.3, 0.3)

        clinics.append({
            "slug": slug,
            "name": name,
            "tier": tier,
            "district": district["name"],
            "lat": round(lat, 4),
            "lng": round(lng, 4),
            "specialisations": specialisations,
            "prakriti_affinities": prakriti_affinities,
            "languages": languages,
            "pricing_min": pricing_min,
            "pricing_max": pricing_max,
            "certifications": certs,
            "outcome_enrolled": tier == 2 or RNG.random() < 0.3,
            "accommodation_available": RNG.random() < 0.75,
            "address": f"{RNG.randint(1, 999)} {prefix} Road, {district['name']}, Kerala",
            "transport_info": f"Approx. {RNG.randint(15, 90)} min from nearest airport. Contact clinic for transfers.",
            "rating": round(RNG.uniform(3.8, 4.9), 1),
            "review_count": RNG.randint(10, 180),
            "photos": [CLINIC_PHOTO_URLS[i % len(CLINIC_PHOTO_URLS)], CLINIC_PHOTO_URLS[(i + 5) % len(CLINIC_PHOTO_URLS)]],
        })

    return clinics


def generate_doctor_name() -> tuple[str, str]:
    """Return (name, gender) pair."""
    if RNG.random() < 0.45:
        return f"Dr. {RNG.choice(DOCTOR_FIRST_NAMES_F)} {RNG.choice(DOCTOR_LAST_NAMES)}", "f"
    return f"Dr. {RNG.choice(DOCTOR_FIRST_NAMES_M)} {RNG.choice(DOCTOR_LAST_NAMES)}", "m"


def make_doctor_slug(name: str, clinic_slug: str, idx: int) -> str:
    clean = name.lower().replace("dr. ", "").replace(" ", "-").replace(".", "")
    return f"{clean}-{clinic_slug[:20]}-{idx}"


def make_bio(name: str, qual: str, years: int, specs: list[str]) -> str:
    spec_str = ", ".join(specs[:2])
    return (
        f"{name} holds {qual} and brings {years} years of clinical experience "
        f"specialising in {spec_str}. Their patient-centred approach integrates "
        f"classical Ayurvedic texts with modern clinical practice."
    )


# ── Reset ─────────────────────────────────────────────────────────────────────

def reset_seed_data(session: Session) -> None:
    print("  Truncating tables in FK-safe order...")
    for tbl in [
        "order_items", "product_orders", "product_variants", "products",
        "reviews", "bookings", "doctor_treatments", "treatments",
        "doctors", "clinic_feature_store", "conditions_map", "patient_profiles",
    ]:
        session.execute(text(f"DELETE FROM {tbl}"))
    session.commit()
    print("  All seed tables cleared.")


# ── Seed functions ────────────────────────────────────────────────────────────

def seed_conditions(session: Session) -> None:
    print("\n[1/9] Seeding conditions map...")
    conditions = yaml.safe_load((ROOT / "config" / "conditions.yaml").read_text())["conditions"]
    added = 0
    for cond in conditions:
        if session.query(ConditionMap).filter_by(condition_slug=cond["condition_slug"]).first():
            continue
        session.add(ConditionMap(
            id=uuid.uuid4(),
            condition_slug=cond["condition_slug"],
            condition_name=cond["condition_name"],
            condition_name_ar=cond.get("condition_name_ar"),
            condition_name_ml=cond.get("condition_name_ml"),
            treatment_slugs=cond.get("treatment_slugs", []),
        ))
        added += 1
    session.commit()
    print(f"  {added} conditions added ({len(conditions) - added} already existed).")


def seed_clinics(session: Session, clinic_data: list[dict]) -> dict[str, ClinicFeatureStore]:
    print("\n[2/9] Seeding clinics...")
    clinic_map: dict[str, ClinicFeatureStore] = {}
    added = 0

    for c in clinic_data:
        existing = session.query(ClinicFeatureStore).filter_by(slug=c["slug"]).first()
        if existing:
            clinic_map[c["slug"]] = existing
            continue

        obj = ClinicFeatureStore(
            id=uuid.uuid4(), slug=c["slug"], name=c["name"], tier=c["tier"],
            district=c["district"], lat=c["lat"], lng=c["lng"],
            specialisations=c["specialisations"], prakriti_affinities=c["prakriti_affinities"],
            languages=c["languages"], pricing_min=c["pricing_min"], pricing_max=c["pricing_max"],
            certifications=c["certifications"], outcome_enrolled=c["outcome_enrolled"],
            accommodation_available=c["accommodation_available"],
            address=c["address"], transport_info=c["transport_info"],
            rating=c["rating"], review_count=c["review_count"],
            photos=c["photos"], is_active=True,
        )
        session.add(obj)
        session.flush()
        clinic_map[c["slug"]] = obj
        added += 1

    session.commit()
    print(f"  {added} clinics added ({len(clinic_data) - added} already existed).  Total: {len(clinic_data)}")
    return clinic_map


def seed_doctors(session: Session, clinic_map: dict[str, ClinicFeatureStore]) -> dict[str, list[Doctor]]:
    """Generate 1–10 doctors per clinic. Returns dict: clinic_slug → [Doctor, ...]."""
    print("\n[3/9] Seeding doctors...")
    doctors_by_clinic: dict[str, list[Doctor]] = {slug: [] for slug in clinic_map}
    added = 0

    for clinic_slug, clinic in clinic_map.items():
        n_doctors = RNG.randint(1, 10)
        for idx in range(n_doctors):
            name, gender = generate_doctor_name()
            slug = make_doctor_slug(name, clinic_slug, idx)

            existing = session.query(Doctor).filter_by(slug=slug).first()
            if existing:
                doctors_by_clinic[clinic_slug].append(existing)
                continue

            years_exp = RNG.randint(3, 30)
            qual = RNG.choice(QUALIFICATIONS)
            tier = 2 if (clinic.tier == 2 and years_exp >= 8 and RNG.random() < 0.6) else 1
            specs = RNG.sample(clinic.specialisations or ALL_SPECIALISATIONS[:8], min(RNG.randint(2, 4), len(clinic.specialisations or ALL_SPECIALISATIONS)))
            prakriti_affs = RNG.sample(["vata", "pitta", "kapha", "vata-pitta", "pitta-kapha"], RNG.randint(1, 3))
            langs = clinic.languages or ["en"]

            photo_pool = DOCTOR_PHOTO_FEMALE if gender == "f" else DOCTOR_PHOTO_MALE
            photo_url  = photo_pool[added % len(photo_pool)]

            doc = Doctor(
                id=uuid.uuid4(), slug=slug, name=name, qualification=qual,
                years_exp=years_exp, clinic_id=clinic.id,
                specialisations=specs, prakriti_affinities=prakriti_affs,
                languages=langs, bio=make_bio(name, qual, years_exp, specs),
                tier=tier, patients_treated=RNG.randint(50, 3000),
                rating=round(RNG.uniform(3.7, 5.0), 1),
                review_count=RNG.randint(5, 200),
                pricing_per_day=RNG.randint(6, 20) * 10,
                photo_url=photo_url,
                is_active=True,
            )
            session.add(doc)
            session.flush()
            doctors_by_clinic[clinic_slug].append(doc)
            added += 1

    session.commit()
    total = sum(len(v) for v in doctors_by_clinic.values())
    print(f"  {added} doctors added.  Total: {total}")
    return doctors_by_clinic


def seed_treatments(
    session: Session,
    clinic_map: dict[str, ClinicFeatureStore],
    doctors_by_clinic: dict[str, list[Doctor]],
) -> dict[str, list[Treatment]]:
    """2–5 treatments per clinic, linked to 1–3 doctors via DoctorTreatment junction."""
    print("\n[4/9] Seeding treatments + doctor_treatments...")
    treatments_by_clinic: dict[str, list[Treatment]] = {slug: [] for slug in clinic_map}
    t_added, dt_added = 0, 0

    for clinic_slug, clinic in clinic_map.items():
        n_treatments = RNG.randint(2, min(5, len(TREATMENT_TEMPLATES)))
        templates = RNG.sample(TREATMENT_TEMPLATES, n_treatments)
        docs = doctors_by_clinic.get(clinic_slug, [])

        for tmpl in templates:
            slug = f"{tmpl['slug_suffix']}-{clinic_slug[:30]}"

            existing = session.query(Treatment).filter_by(slug=slug).first()
            if existing:
                treatments_by_clinic[clinic_slug].append(existing)
            else:
                price = RNG.randint(*[p // 10 for p in tmpl["price_range"]]) * 10
                treatment = Treatment(
                    id=uuid.uuid4(), slug=slug, name=tmpl["name"],
                    description=tmpl["description"],
                    prakriti_tags=tmpl["prakriti_tags"],
                    duration_min_days=tmpl["duration_min"],
                    duration_max_days=tmpl["duration_max"],
                    price_per_day=price,
                    included_therapies=tmpl["therapies"],
                    clinic_id=clinic.id, is_active=True,
                )
                session.add(treatment)
                session.flush()
                treatments_by_clinic[clinic_slug].append(treatment)
                t_added += 1

            treatment = treatments_by_clinic[clinic_slug][-1]

            # Link 1–3 doctors to this treatment via junction
            if docs:
                n_linked = min(RNG.randint(1, 3), len(docs))
                linked_docs = RNG.sample(docs, n_linked)
                for i, doc in enumerate(linked_docs):
                    exists = session.query(DoctorTreatment).filter_by(
                        doctor_id=doc.id, treatment_id=treatment.id
                    ).first()
                    if not exists:
                        session.add(DoctorTreatment(
                            id=uuid.uuid4(),
                            doctor_id=doc.id,
                            treatment_id=treatment.id,
                            is_primary=(i == 0),
                        ))
                        dt_added += 1

    session.commit()
    total = sum(len(v) for v in treatments_by_clinic.values())
    print(f"  {t_added} treatments added ({total} total). {dt_added} doctor_treatment links added.")
    return treatments_by_clinic


def seed_products(
    session: Session,
    clinic_map: dict[str, ClinicFeatureStore],
) -> None:
    """3–8 products per clinic with 2–4 variants each."""
    print("\n[5/9] Seeding products + variants...")
    p_added, v_added = 0, 0

    for clinic_slug, clinic in clinic_map.items():
        n_products = RNG.randint(3, 8)
        templates = RNG.sample(PRODUCT_TEMPLATES, n_products)

        for tmpl in templates:
            slug = f"{slugify(tmpl['name'])}-{clinic_slug[:25]}"

            existing = session.query(Product).filter_by(slug=slug).first()
            if existing:
                continue

            gmp = clinic.certifications and "GMP" in clinic.certifications
            product = Product(
                id=uuid.uuid4(), clinic_id=clinic.id, slug=slug,
                name=tmpl["name"], description=tmpl["desc"],
                category=tmpl["category"],
                prakriti_tags=tmpl["prakriti"],
                base_price=tmpl["base"],
                currency="INR",
                photos=[PRODUCT_PHOTO_URLS.get(tmpl["category"], PRODUCT_PHOTO_DEFAULT)],
                is_gmp_certified=gmp or RNG.random() < 0.3,
                is_active=True,
            )
            session.add(product)
            session.flush()
            p_added += 1

            # Variants
            size_list = VARIANT_SIZES.get(tmpl["category"], [("standard", 0)])
            n_variants = RNG.randint(2, min(4, len(size_list)))
            chosen_sizes = size_list[:n_variants]
            base = tmpl["base"]

            for label, premium in chosen_sizes:
                price = base + premium + RNG.randint(-30, 30)
                sku = f"{slugify(tmpl['name'])[:28]}-{str(product.id)[:8]}-{label.replace(' ', '')}"
                session.add(ProductVariant(
                    id=uuid.uuid4(), product_id=product.id,
                    label=label, sku=sku,
                    price=max(price, 100),
                    stock_qty=RNG.randint(0, 50),
                    weight_grams=RNG.randint(100, 600),
                    is_active=True,
                ))
                v_added += 1

    session.commit()
    print(f"  {p_added} products added with {v_added} variants.")


def seed_patients(session: Session, n: int = 25) -> list[PatientProfile]:
    """Seed test patient profiles."""
    print("\n[6/9] Seeding patient profiles...")
    patients = []
    added = 0

    for i in range(n):
        pseudo_id = f"test-patient-{i+1:03d}"
        existing = session.query(PatientProfile).filter_by(pseudo_id=pseudo_id).first()
        if existing:
            patients.append(existing)
            continue

        dosha = RNG.choice(["vata", "pitta", "kapha", "vata-pitta", "pitta-kapha"])
        p = PatientProfile(
            id=uuid.uuid4(), pseudo_id=pseudo_id,
            prakriti_scores={"vata": RNG.randint(20, 60), "pitta": RNG.randint(20, 60), "kapha": RNG.randint(20, 60)},
            dosha_type=dosha,
            language=RNG.choice(["en", "ar", "de", "fr", "ml"]),
            assessment_status="completed",
        )
        session.add(p)
        session.flush()
        patients.append(p)
        added += 1

    session.commit()
    print(f"  {added} patient profiles added.")
    return patients


def seed_bookings_and_reviews(
    session: Session,
    patients: list[PatientProfile],
    clinic_map: dict[str, ClinicFeatureStore],
    doctors_by_clinic: dict[str, list[Doctor]],
    treatments_by_clinic: dict[str, list[Treatment]],
) -> None:
    """2–4 bookings per patient, ~75% get a review."""
    print("\n[7/9] Seeding bookings + reviews...")
    clinic_list = list(clinic_map.values())
    b_added = r_added = 0

    from db.models import Booking

    for patient in patients:
        n_bookings = RNG.randint(2, 4)
        for _ in range(n_bookings):
            clinic = RNG.choice(clinic_list)
            docs    = doctors_by_clinic.get(clinic.slug, [])
            treats  = treatments_by_clinic.get(clinic.slug, [])
            if not docs or not treats:
                continue

            doc       = RNG.choice(docs)
            treatment = RNG.choice(treats)
            days_ago  = RNG.randint(30, 500)
            start     = date.today() - timedelta(days=days_ago)
            duration  = RNG.randint(treatment.duration_min_days or 7, treatment.duration_max_days or 14)
            end       = start + timedelta(days=duration)
            ppu       = float(treatment.price_per_day or 100)
            total     = ppu * duration
            commission = round(total * RNG.uniform(0.06, 0.15), 2)

            booking = Booking(
                id=uuid.uuid4(),
                patient_pseudo_id=patient.pseudo_id,
                clinic_id=clinic.id, doctor_id=doc.id, treatment_id=treatment.id,
                start_date=start, end_date=end, status="completed",
                payment_ref=f"PAY-{uuid.uuid4().hex[:10].upper()}",
                total_amount=total, commission_amount=commission,
                currency=RNG.choice(["USD", "EUR", "INR", "AED"]),
                lang=patient.language or "en",
                stripe_session_id=f"cs_test_{uuid.uuid4().hex[:24]}",
            )
            session.add(booking)
            session.flush()
            b_added += 1

            # ~75% of bookings get a review
            if RNG.random() < 0.75:
                rating  = RNG.choices([3, 4, 4, 5, 5, 5], k=1)[0]
                session.add(Review(
                    id=uuid.uuid4(),
                    patient_pseudo_id=patient.pseudo_id,
                    clinic_id=clinic.id, doctor_id=doc.id, booking_id=booking.id,
                    rating=rating,
                    review_text=RNG.choice(REVIEW_TEXTS),
                    treatment_slug=treatment.slug,
                    reviewer_location=RNG.choice(REVIEWER_LOCATIONS),
                    verified=True,
                ))
                r_added += 1

    session.commit()
    print(f"  {b_added} bookings added. {r_added} reviews added.")


def seed_product_orders(
    session: Session,
    patients: list[PatientProfile],
    clinic_map: dict[str, ClinicFeatureStore],
) -> None:
    """1–3 product orders per patient from a random clinic's products."""
    print("\n[8/9] Seeding product orders + order items...")
    o_added = i_added = 0
    clinic_list = list(clinic_map.values())

    for patient in patients:
        n_orders = RNG.randint(1, 3)
        for _ in range(n_orders):
            clinic = RNG.choice(clinic_list)
            products = session.query(Product).filter_by(clinic_id=clinic.id, is_active=True).all()
            if not products:
                continue

            order = ProductOrder(
                id=uuid.uuid4(),
                patient_pseudo_id=patient.pseudo_id,
                clinic_id=clinic.id,
                status=RNG.choice(["paid", "dispatched", "delivered", "delivered", "delivered"]),
                currency="INR",
                payment_ref=f"ORD-{uuid.uuid4().hex[:10].upper()}",
                shipping_address={
                    "name": patient.pseudo_id,
                    "line1": f"{RNG.randint(1, 999)} Test Street",
                    "city": RNG.choice(["Dubai", "London", "Berlin", "Doha", "Singapore"]),
                    "country": RNG.choice(["AE", "GB", "DE", "QA", "SG", "AU"]),
                },
            )
            session.add(order)
            session.flush()
            o_added += 1

            # 1–4 line items
            chosen_products = RNG.sample(products, min(RNG.randint(1, 4), len(products)))
            order_total = 0.0
            for prod in chosen_products:
                variants = session.query(ProductVariant).filter_by(product_id=prod.id, is_active=True).all()
                variant = RNG.choice(variants) if variants else None
                unit_price = float(variant.price if variant else (prod.base_price or 500))
                qty = RNG.randint(1, 3)
                subtotal = unit_price * qty
                order_total += subtotal

                session.add(OrderItem(
                    id=uuid.uuid4(), order_id=order.id,
                    product_id=prod.id,
                    variant_id=variant.id if variant else None,
                    quantity=qty, unit_price=unit_price, subtotal=subtotal,
                ))
                i_added += 1

            order.total_amount = round(order_total, 2)

    session.commit()
    print(f"  {o_added} product orders added with {i_added} order items.")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Vaidya development data")
    parser.add_argument("--reset", action="store_true", help="Wipe and re-seed all tables")
    args = parser.parse_args()

    print(f"\nConnecting to: {DATABASE_SYNC_URL.split('@')[-1]}")

    clinic_data = generate_clinics(50)

    with Session(engine) as session:
        if args.reset:
            print("\n[--reset] Clearing existing seed data...")
            reset_seed_data(session)

        seed_conditions(session)
        clinic_map          = seed_clinics(session, clinic_data)
        doctors_by_clinic   = seed_doctors(session, clinic_map)
        treatments_by_clinic = seed_treatments(session, clinic_map, doctors_by_clinic)
        seed_products(session, clinic_map)
        patients            = seed_patients(session)
        seed_bookings_and_reviews(session, patients, clinic_map, doctors_by_clinic, treatments_by_clinic)
        seed_product_orders(session, patients, clinic_map)

    # Summary
    print("\n" + "─" * 50)
    print("Seed complete.")
    print(f"  Clinics        : {len(clinic_data)}")
    print(f"  Doctors        : ~{sum(RNG.randint(1,10) for _ in range(len(clinic_data)))//len(clinic_data)} avg per clinic")
    print(f"  Conditions     : {len(yaml.safe_load((ROOT / 'config' / 'conditions.yaml').read_text())['conditions'])}")
    print(f"  Treatments     : 2–5 per clinic")
    print(f"  Products       : 3–8 per clinic with 2–4 variants each")
    print(f"  Patients       : 25 test profiles  (pseudo_id: test-patient-001 … test-patient-025)")
    print(f"  Bookings       : 2–4 per patient with reviews")
    print(f"  Product orders : 1–3 per patient")
    print("─" * 50)


if __name__ == "__main__":
    main()

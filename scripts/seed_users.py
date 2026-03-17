#!/usr/bin/env python3
"""
scripts/seed_users.py — Create sample user accounts for development/testing.

Run from project root:
    python scripts/seed_users.py

Creates 5 users across different personas:
  - patient (Gulf NRI, Vata type)
  - patient (European wellness tourist, Pitta type)
  - patient (Indian domestic, Kapha type)
  - clinic_admin (manages a Kerala clinic)
  - platform_admin (internal staff)

All passwords are:  DevPass123!
"""
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

env_file = ROOT / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

import bcrypt as _bcrypt
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from db.models import Base, User, UserPreferences

DATABASE_SYNC_URL = os.environ.get(
    "DATABASE_SYNC_URL",
    "postgresql://vaidya:vaidya_dev@localhost:5432/vaidya",
).replace("@postgres:", "@localhost:")

engine = create_engine(DATABASE_SYNC_URL, echo=False)


def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()

SAMPLE_USERS = [
    {
        "email": "priya.nair@example.com",
        "full_name": "Priya Nair",
        "password": "password123",
        "role": "patient",
        "preferred_language": "en",
        "phone": "+971501234567",
        "prakriti": {"primary_type": "vata", "vata_pct": 58, "pitta_pct": 28, "kapha_pct": 14},
    },
    {
        "email": "thomas.weber@example.com",
        "full_name": "Thomas Weber",
        "password": "password123",
        "role": "patient",
        "preferred_language": "de",
        "phone": "+4917612345678",
        "prakriti": {"primary_type": "pitta", "vata_pct": 22, "pitta_pct": 55, "kapha_pct": 23},
    },
    {
        "email": "anitha.krishnan@example.com",
        "full_name": "Anitha Krishnan",
        "password": "password123",
        "role": "patient",
        "preferred_language": "ml",
        "phone": "+919876543210",
        "prakriti": {"primary_type": "kapha", "vata_pct": 18, "pitta_pct": 24, "kapha_pct": 58},
    },
    {
        "email": "admin@somatheeram.example.com",
        "full_name": "Suresh Pillai",
        "password": "password123",
        "role": "clinic_admin",
        "preferred_language": "en",
        "phone": "+914712345678",
        "prakriti": None,
    },
    {
        "email": "admin@vaidya.example.com",
        "full_name": "Platform Admin",
        "password": "password123",
        "role": "platform_admin",
        "preferred_language": "en",
        "phone": None,
        "prakriti": None,
    },
]


def seed_users():
    with Session(engine) as db:
        created = 0
        skipped = 0
        for spec in SAMPLE_USERS:
            existing = db.scalar(select(User).where(User.email == spec["email"]))
            if existing:
                skipped += 1
                print(f"  skip  {spec['email']} (already exists)")
                continue

            user = User(
                id=uuid.uuid4(),
                email=spec["email"],
                full_name=spec["full_name"],
                password_hash=hash_password(spec["password"]),
                role=spec["role"],
                preferred_language=spec["preferred_language"],
                phone=spec["phone"],
                is_active=True,
                is_email_verified=True,
            )
            db.add(user)
            db.flush()  # get user.id before adding preferences

            if spec["prakriti"]:
                prefs = UserPreferences(
                    user_id=user.id,
                    prakriti_primary_type=spec["prakriti"]["primary_type"],
                    prakriti_vata_pct=spec["prakriti"]["vata_pct"],
                    prakriti_pitta_pct=spec["prakriti"]["pitta_pct"],
                    prakriti_kapha_pct=spec["prakriti"]["kapha_pct"],
                )
                db.add(prefs)

            created += 1
            print(f"  create {spec['email']}  ({spec['role']})")

        db.commit()

    print(f"\nDone — {created} created, {skipped} skipped.")
    print("\nAll passwords: DevPass123!")
    print("\nTest accounts summary:")
    print("  priya.nair@example.com         patient  Vata  (Gulf NRI)")
    print("  thomas.weber@example.com        patient  Pitta (European tourist)")
    print("  anitha.krishnan@example.com     patient  Kapha (Indian domestic)")
    print("  admin@somatheeram.example.com   clinic_admin")
    print("  admin@vaidya.example.com        platform_admin")


if __name__ == "__main__":
    seed_users()

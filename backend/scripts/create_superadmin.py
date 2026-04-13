#!/usr/bin/env python3
"""
scripts/create_superadmin.py — Create or update a platform_admin user.

Usage (local / Docker):
    python scripts/create_superadmin.py --email admin@vaidya.io --name "Platform Admin" --password "YourStrongPassword"

    # Or let it prompt for the password interactively (recommended for production):
    python scripts/create_superadmin.py --email admin@vaidya.io --name "Platform Admin"

Run inside the Docker container:
    docker exec -it vaidya-backend python scripts/create_superadmin.py --email admin@vaidya.io --name "Platform Admin"

In production (if using a managed service like Railway / Render / AWS ECS):
    Run as a one-off command in your deployment platform, or SSH into the instance and run it there.
"""

import argparse
import asyncio
import getpass
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ── Path / env setup ──────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
_backend = ROOT / "backend"
sys.path.insert(0, str(_backend if _backend.is_dir() else ROOT))

# Load .env.local if present (local dev)
env_file = ROOT / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

# ── Main ──────────────────────────────────────────────────────────────────────

async def run(email: str, full_name: str, password: str) -> None:
    import bcrypt
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    from db.models import User

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is not set.")
        sys.exit(1)

    engine = create_async_engine(database_url, echo=False)

    async with AsyncSession(engine) as session:
        existing = (
            await session.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()

        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        now = datetime.now(timezone.utc)

        if existing:
            if existing.role == "platform_admin":
                confirm = input(
                    f"\nUser '{email}' already exists as platform_admin. "
                    "Update password? [y/N] "
                ).strip().lower()
                if confirm != "y":
                    print("Aborted.")
                    return
                existing.password_hash = password_hash
                existing.updated_at = now
                await session.commit()
                print(f"\n✓ Password updated for {email}")
            else:
                print(
                    f"\nERROR: '{email}' already exists with role '{existing.role}'. "
                    "Cannot convert an existing user to platform_admin."
                )
                sys.exit(1)
        else:
            user = User(
                id=uuid.uuid4(),
                email=email,
                full_name=full_name,
                password_hash=password_hash,
                role="platform_admin",
                is_active=True,
                is_email_verified=True,
                created_at=now,
                updated_at=now,
            )
            session.add(user)
            await session.commit()
            print(f"\n✓ Created platform_admin: {email}")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a Vaidya platform_admin user.")
    parser.add_argument("--email",    required=True,  help="Admin email address")
    parser.add_argument("--name",     required=True,  help="Full name")
    parser.add_argument("--password", required=False, help="Password (omit to be prompted securely)")
    args = parser.parse_args()

    if args.password:
        password = args.password
    else:
        password = getpass.getpass(prompt=f"Password for {args.email}: ")
        confirm  = getpass.getpass(prompt="Confirm password: ")
        if password != confirm:
            print("Passwords do not match.")
            sys.exit(1)

    if len(password) < 12:
        print("ERROR: Password must be at least 12 characters.")
        sys.exit(1)

    asyncio.run(run(args.email, args.name, password))


if __name__ == "__main__":
    main()

"""
core/session_claim.py — Session claiming logic.

Called at login to migrate guest session data to the authenticated user account.
Tables with (user_id, session_id) columns:
  - user_preferences    — merge prakriti only if user has none
  - user_watchlist      — bulk transfer
  - booking_history     — bulk transfer
  - consultation_history — bulk transfer
  - prescriptions       — bulk transfer
  - product_purchase_history — bulk transfer
"""

import logging
import uuid

from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import (
    BookingHistory,
    ConsultationHistory,
    GuestSession,
    OutcomesLog,
    Prescription,
    ProductPurchaseHistory,
    UserPreferences,
    UserWatchlist,
)

logger = logging.getLogger(__name__)


async def claim_session(
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """
    Migrate all guest session data to the authenticated user.
    Returns True if session was found and processed, False if not found.
    """
    guest = await db.get(GuestSession, session_id)
    if not guest:
        return False

    # Mark session as claimed
    guest.claimed_by_user_id = user_id

    # ── user_preferences ──────────────────────────────────────────────────────
    user_prefs_result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )
    user_prefs = user_prefs_result.scalar_one_or_none()

    session_prefs_result = await db.execute(
        select(UserPreferences).where(UserPreferences.session_id == session_id)
    )
    session_prefs = session_prefs_result.scalar_one_or_none()

    if session_prefs:
        if user_prefs is None:
            # Transfer: bind to user, release session
            session_prefs.user_id = user_id
            session_prefs.session_id = None
        else:
            # Merge: copy prakriti only if user has no prakriti yet
            if (
                user_prefs.prakriti_primary_type is None
                and session_prefs.prakriti_primary_type is not None
            ):
                user_prefs.prakriti_vata_pct = session_prefs.prakriti_vata_pct
                user_prefs.prakriti_pitta_pct = session_prefs.prakriti_pitta_pct
                user_prefs.prakriti_kapha_pct = session_prefs.prakriti_kapha_pct
                user_prefs.prakriti_primary_type = session_prefs.prakriti_primary_type
                user_prefs.prakriti_secondary_type = session_prefs.prakriti_secondary_type
                user_prefs.prakriti_completed_at = session_prefs.prakriti_completed_at
                user_prefs.prakriti_assessment_id = session_prefs.prakriti_assessment_id

    # ── user_watchlist ─────────────────────────────────────────────────────────
    await db.execute(
        update(UserWatchlist)
        .where(UserWatchlist.session_id == session_id)
        .values(user_id=user_id, session_id=None)
    )

    # ── booking_history ────────────────────────────────────────────────────────
    await db.execute(
        update(BookingHistory)
        .where(BookingHistory.session_id == session_id)
        .values(user_id=user_id, session_id=None)
    )

    # ── consultation_history ───────────────────────────────────────────────────
    await db.execute(
        update(ConsultationHistory)
        .where(ConsultationHistory.session_id == session_id)
        .values(user_id=user_id, session_id=None)
    )

    # ── prescriptions ──────────────────────────────────────────────────────────
    await db.execute(
        update(Prescription)
        .where(Prescription.session_id == session_id)
        .values(user_id=user_id, session_id=None)
    )

    # ── product_purchase_history ───────────────────────────────────────────────
    await db.execute(
        update(ProductPurchaseHistory)
        .where(ProductPurchaseHistory.session_id == session_id)
        .values(user_id=user_id, session_id=None)
    )

    # ── outcomes_log (append-only) ─────────────────────────────────────────────
    db.add(
        OutcomesLog(
            event_type="session_claimed",
            patient_pseudo_id=str(user_id),
            answers_raw={"session_id": str(session_id)},
        )
    )

    logger.info("Session %s claimed by user %s", session_id, user_id)
    return True

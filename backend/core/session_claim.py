"""
core/session_claim.py — Session claiming logic.

Called at login to migrate guest session data to the authenticated user account.
Tables with (user_id, session_id) columns:
  - user_watchlist      — bulk transfer
  - booking_history     — bulk transfer
"""

import logging
import uuid

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import (
    BookingHistory,
    GuestSession,
    OutcomesLog,
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

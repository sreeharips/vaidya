"""
Append-only outcomes log writer.

APPEND-ONLY — never UPDATE or DELETE any row. This is the AI training corpus.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import OutcomesLog


async def append_outcome(
    session: AsyncSession,
    *,
    event_type: str,
    patient_pseudo_id: str | None = None,
    clinic_id=None,
    answers_raw: dict | None = None,
    scores: dict | None = None,
    booking_status: str | None = None,
    medicine_ordered: bool = False,
) -> OutcomesLog:
    entry = OutcomesLog(
        event_type=event_type,
        patient_pseudo_id=patient_pseudo_id,
        clinic_id=clinic_id,
        answers_raw=answers_raw,
        scores=scores,
        booking_status=booking_status,
        medicine_ordered=medicine_ordered,
    )
    session.add(entry)
    await session.flush()
    return entry

"""
api/assessment.py — Prakriti assessment endpoints.

GET  /api/assessment/questions?lang=en
POST /api/assessment/score
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import any_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.prakriti import Answer, classify_dosha, _load_questions, score as compute_score
from db.database import get_db
from db.models import ClinicFeatureStore
from db.outcomes import append_outcome

router = APIRouter(prefix="/api/assessment", tags=["assessment"])

_LANG_FALLBACK = "en"
_TOTAL_QUESTIONS = 22
_MIN_ANSWERS = 18


# ── Pydantic models ───────────────────────────────────────────────────────────


class OptionOut(BaseModel):
    index: int
    text: str


class QuestionOut(BaseModel):
    id: str
    category: str
    text: str
    spoken_prompt: str
    reask_prompt: str
    options: list[OptionOut]


class AnswerIn(BaseModel):
    question_id: str = Field(..., pattern=r"^q\d{2}$")
    option_index: int = Field(..., ge=0, le=2)


class ScoreRequest(BaseModel):
    answers: list[AnswerIn] = Field(..., min_length=_MIN_ANSWERS, max_length=_TOTAL_QUESTIONS)
    patient_pseudo_id: str | None = None
    session_type: str = Field(default="form", pattern="^(form|voice)$")

    @model_validator(mode="after")
    def check_no_duplicate_questions(self) -> "ScoreRequest":
        ids = [a.question_id for a in self.answers]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate question_id in answers — each question may only be answered once")
        return self


class ClinicMatch(BaseModel):
    id: str
    slug: str
    name: str
    tier: int
    district: str | None
    rating: float | None
    pricing_min: float | None
    pricing_max: float | None
    prakriti_affinities: list[str]


class ScoreResponse(BaseModel):
    vata_pct: int
    pitta_pct: int
    kapha_pct: int
    primary_type: str
    secondary_type: str | None
    dosha_type: str
    tendencies: list[str]
    treatment_affinities: list[str]
    retreat_focus: str
    matched_clinics: list[ClinicMatch]
    outcome_log_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _localised(field_value: str | dict, lang: str) -> str:
    """Return localised string for a question field.

    questions.yaml currently stores all text as plain strings (English).
    When per-language content is added the YAML will use a dict:
        text: {en: "...", ar: "...", ml: "..."}
    This helper handles both formats without changing call sites.
    """
    if isinstance(field_value, dict):
        return field_value.get(lang) or field_value.get(_LANG_FALLBACK, "")
    return str(field_value)


# ── GET /api/assessment/questions ─────────────────────────────────────────────


@router.get("/questions", response_model=list[QuestionOut])
async def get_questions(
    lang: str = Query(
        default="en",
        pattern="^(en|ar|de|fr|ml|hi)$",
        description="Response language. All text is currently English; AR/ML/HI localisation is Phase 2.",
    ),
):
    """Return all 22 Prakriti assessment questions.

    - **Form UI**: use `text` as the display label.
    - **Voice UI**: use `spoken_prompt` for TTS; use `reask_prompt` when
      voice confidence is below the retry threshold.
    - Option `vata`/`pitta`/`kapha` scores are never returned to the client.
    """
    data = _load_questions()

    return [
        QuestionOut(
            id=q["id"],
            category=q["category"],
            text=_localised(q["text"], lang),
            spoken_prompt=_localised(q.get("spoken_prompt", q["text"]), lang),
            reask_prompt=_localised(q.get("reask_prompt", q["text"]), lang),
            options=[
                OptionOut(index=i, text=_localised(opt["text"], lang))
                for i, opt in enumerate(q["options"])
            ],
        )
        for q in data["questions"]
    ]


# ── POST /api/assessment/score ────────────────────────────────────────────────


@router.post("/score", response_model=ScoreResponse, status_code=200)
async def score_assessment(
    request: ScoreRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Score a completed Prakriti assessment.

    **Rules:**
    - At least 18 of 22 questions must be answered.
    - Each `question_id` must appear at most once.
    - `option_index` must be 0, 1, or 2.

    **Side effects:**
    - One row is appended to `outcomes_log` (event_type = `assessment_complete`).
    - The log row stores raw answers (JSONB) and computed scores. It is **never**
      updated or deleted — it is the AI training corpus.

    **Returns:**
    - Dosha percentages, classification, treatment affinities.
    - Top 6 clinics matched on `primary_type` in their `prakriti_affinities`.
    """
    data = _load_questions()
    q_index: dict[str, dict] = {q["id"]: q for q in data["questions"]}

    # Validate question IDs
    unknown_ids = [a.question_id for a in request.answers if a.question_id not in q_index]
    if unknown_ids:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown question_id(s): {unknown_ids}. Valid IDs are q01–q22.",
        )

    # Validate option indices against actual option counts
    for a in request.answers:
        n_opts = len(q_index[a.question_id]["options"])
        if a.option_index >= n_opts:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"option_index {a.option_index} is out of range for "
                    f"{a.question_id} (has {n_opts} options, indices 0–{n_opts - 1})"
                ),
            )

    # Build Answer objects for the scoring engine (attaches category from YAML)
    answers = [
        Answer(
            question_id=a.question_id,
            category=q_index[a.question_id]["category"],
            option_index=a.option_index,
        )
        for a in request.answers
    ]

    # ── Score — pure Python, no LLM ───────────────────────────────────────────
    profile = compute_score(answers)

    # classify_dosha gives the full combined type ("Vata-Pitta", "Tridosha", etc.)
    dosha_type = classify_dosha(profile.vata, profile.pitta, profile.kapha)

    # ── Clinic matching ────────────────────────────────────────────────────────
    # Match clinics where primary_type (e.g. "vata") appears in prakriti_affinities[].
    # Ties broken by tier desc, then rating desc.
    primary_lower = profile.primary_type.lower()

    clinic_rows = await db.execute(
        select(ClinicFeatureStore)
        .where(
            ClinicFeatureStore.is_active.is_(True),
            primary_lower == any_(ClinicFeatureStore.prakriti_affinities),
        )
        .order_by(
            ClinicFeatureStore.tier.desc(),
            ClinicFeatureStore.rating.desc().nulls_last(),
        )
        .limit(6)
    )
    clinics = clinic_rows.scalars().all()

    matched_clinics = [
        ClinicMatch(
            id=str(c.id),
            slug=c.slug,
            name=c.name,
            tier=c.tier,
            district=c.district,
            rating=float(c.rating) if c.rating is not None else None,
            pricing_min=float(c.pricing_min) if c.pricing_min is not None else None,
            pricing_max=float(c.pricing_max) if c.pricing_max is not None else None,
            prakriti_affinities=c.prakriti_affinities or [],
        )
        for c in clinics
    ]

    # ── Outcomes log — APPEND ONLY ────────────────────────────────────────────
    pseudo_id = request.patient_pseudo_id or f"anon-{uuid.uuid4().hex[:12]}"

    log_entry = await append_outcome(
        db,
        event_type="assessment_complete",
        patient_pseudo_id=pseudo_id,
        answers_raw={a.question_id: a.option_index for a in request.answers},
        scores={
            "vata": profile.vata,
            "pitta": profile.pitta,
            "kapha": profile.kapha,
            "primary_type": profile.primary_type,
            "secondary_type": profile.secondary_type,
            "dosha_type": dosha_type,
            "session_type": request.session_type,
            "questions_answered": len(request.answers),
        },
    )

    return ScoreResponse(
        vata_pct=profile.vata,
        pitta_pct=profile.pitta,
        kapha_pct=profile.kapha,
        primary_type=profile.primary_type,
        secondary_type=profile.secondary_type,
        dosha_type=dosha_type,
        tendencies=profile.tendencies,
        treatment_affinities=profile.treatment_affinities,
        retreat_focus=profile.retreat_focus,
        matched_clinics=matched_clinics,
        outcome_log_id=str(log_entry.id),
    )

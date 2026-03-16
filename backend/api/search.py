"""
api/search.py — Search endpoints.

GET  /api/search?q=&type=all|doctor|clinic&lang=en&limit=20&offset=0
GET  /api/search/condition?q=back+pain&lang=en
GET  /api/search/condition/{slug}
GET  /api/search/suggestions?q=pan&lang=en
"""

import uuid
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

import yaml

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import (
    Float,
    Integer,
    String,
    cast,
    func,
    literal,
    null,
    or_,
    select,
    union_all,
)
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import (
    ClinicFeatureStore,
    ConditionMap,
    Doctor,
    DoctorTreatment,
    Product,
    SearchEvent,
    Treatment,
)

router = APIRouter(prefix="/api/search", tags=["search"])

# ── Config ────────────────────────────────────────────────────────────────────

_TS_LANG = "english"
_HEADLINE_OPTS = "MaxWords=15,MinWords=5,StartSel=<<,StopSel=>>,ShortWord=3"

# ── Pydantic response models ──────────────────────────────────────────────────


class SearchResult(BaseModel):
    id: str
    type: str  # 'doctor' | 'clinic'
    slug: str
    name: str
    tier: int
    rating: float | None
    district: str | None
    specialisations: list[str]
    snippet: str


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    type: str
    lang: str


@lru_cache(maxsize=1)
def _condition_explanations() -> dict[str, str]:
    """Load explanation text from conditions.yaml, keyed by condition_slug."""
    path = Path("/config/conditions.yaml")
    if not path.exists():
        # Try relative path for local dev
        path = Path("config/conditions.yaml")
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text())
    return {c["condition_slug"]: c.get("explanation", "") for c in data.get("conditions", [])}


class ConditionOut(BaseModel):
    slug: str
    name: str
    treatment_slugs: list[str]
    explanation: str | None = None


class TreatmentBrief(BaseModel):
    id: str
    slug: str
    name: str
    description: str | None
    clinic_id: str | None
    clinic_slug: str | None
    clinic_name: str | None
    duration_min_days: int | None
    duration_max_days: int | None
    price_per_day: float | None
    included_therapies: list[str]


class DoctorBrief(BaseModel):
    id: str
    slug: str
    name: str
    qualification: str
    years_exp: int
    tier: int
    rating: float | None
    review_count: int
    prakriti_affinities: list[str]
    languages: list[str]
    specialisations: list[str]


class ClinicBrief(BaseModel):
    id: str
    slug: str
    name: str
    tier: int
    district: str | None
    rating: float | None
    pricing_min: float | None
    pricing_max: float | None
    specialisations: list[str]


class ProductBrief(BaseModel):
    id: str
    slug: str
    name: str
    description: str | None
    category: str | None
    base_price: float | None
    currency: str
    is_gmp_certified: bool
    clinic_name: str | None
    clinic_slug: str | None


class ConditionSearchResponse(BaseModel):
    condition: ConditionOut
    treatments: list[TreatmentBrief]
    doctors: list[DoctorBrief]
    clinics: list[ClinicBrief]
    products: list[ProductBrief]


class SuggestionItem(BaseModel):
    id: str
    type: str  # 'doctor' | 'clinic' | 'treatment' | 'condition'
    slug: str
    name: str
    subtitle: str | None  # district / qualification / therapy hint


# ── Helpers ───────────────────────────────────────────────────────────────────


def _doctor_text():
    """Concatenated searchable text for a doctor row (NULL-safe)."""
    return func.concat_ws(
        " ",
        Doctor.name,
        Doctor.bio,
        func.array_to_string(Doctor.specialisations, " "),
    )


def _clinic_text():
    """Concatenated searchable text for a clinic row (NULL-safe)."""
    return func.concat_ws(
        " ",
        ClinicFeatureStore.name,
        ClinicFeatureStore.district,
        ClinicFeatureStore.address,
        func.array_to_string(ClinicFeatureStore.specialisations, " "),
    )


def _ts(text_expr):
    return func.to_tsvector(_TS_LANG, text_expr)


def _tsq(q: str):
    return func.plainto_tsquery(_TS_LANG, q)


def _headline(text_expr, tsquery):
    return func.ts_headline(_TS_LANG, text_expr, tsquery, _HEADLINE_OPTS)


async def _resolve_condition_results(
    treatment_slugs: list[str],
    db: AsyncSession,
) -> tuple[list[TreatmentBrief], list[DoctorBrief], list[ClinicBrief], list[ProductBrief]]:
    """Shared query logic for both condition endpoints.

    Given a list of therapy slugs from conditions_map, returns:
    - treatments that include any of those therapies
    - doctors who deliver any of those treatments (via DoctorTreatment junction)
    - clinics that host those treatments
    - products sold by those clinics (up to 8, GMP-certified first)
    """
    treatments: list[TreatmentBrief] = []
    doctors: list[DoctorBrief] = []
    clinics: list[ClinicBrief] = []
    products: list[ProductBrief] = []

    if not treatment_slugs:
        return treatments, doctors, clinics, products

    therapy_array = cast(treatment_slugs, PG_ARRAY(String))

    treatment_rows = (
        await db.execute(
            select(Treatment, ClinicFeatureStore)
            .join(ClinicFeatureStore, Treatment.clinic_id == ClinicFeatureStore.id, isouter=True)
            .where(
                Treatment.is_active.is_(True),
                Treatment.included_therapies.op("&&")(therapy_array),
            )
            .order_by(
                ClinicFeatureStore.tier.desc().nulls_last(),
                ClinicFeatureStore.rating.desc().nulls_last(),
            )
        )
    ).all()

    seen_clinics: set[str] = set()
    seen_doctors: set[str] = set()
    clinic_uuids: list[uuid.UUID] = []

    for t, c in treatment_rows:
        treatments.append(
            TreatmentBrief(
                id=str(t.id),
                slug=t.slug,
                name=t.name,
                description=t.description,
                clinic_id=str(t.clinic_id) if t.clinic_id else None,
                clinic_slug=c.slug if c else None,
                clinic_name=c.name if c else None,
                duration_min_days=t.duration_min_days,
                duration_max_days=t.duration_max_days,
                price_per_day=float(t.price_per_day) if t.price_per_day else None,
                included_therapies=t.included_therapies or [],
            )
        )
        if c and str(c.id) not in seen_clinics:
            seen_clinics.add(str(c.id))
            clinic_uuids.append(c.id)
            clinics.append(
                ClinicBrief(
                    id=str(c.id),
                    slug=c.slug,
                    name=c.name,
                    tier=c.tier,
                    district=c.district,
                    rating=float(c.rating) if c.rating else None,
                    pricing_min=float(c.pricing_min) if c.pricing_min else None,
                    pricing_max=float(c.pricing_max) if c.pricing_max else None,
                    specialisations=c.specialisations or [],
                )
            )

    # ── Doctors via DoctorTreatment junction ──────────────────────────────────
    treatment_ids = [t.id for t, _ in treatment_rows]
    if treatment_ids:
        doctor_rows = (
            await db.execute(
                select(Doctor)
                .join(DoctorTreatment, Doctor.id == DoctorTreatment.doctor_id)
                .where(
                    DoctorTreatment.treatment_id.in_(treatment_ids),
                    Doctor.is_active.is_(True),
                )
                .order_by(Doctor.tier.desc(), Doctor.rating.desc().nulls_last())
                .distinct()
            )
        ).scalars().all()

        for d in doctor_rows:
            if str(d.id) not in seen_doctors:
                seen_doctors.add(str(d.id))
                doctors.append(
                    DoctorBrief(
                        id=str(d.id),
                        slug=d.slug,
                        name=d.name,
                        qualification=d.qualification,
                        years_exp=d.years_exp,
                        tier=d.tier,
                        rating=float(d.rating) if d.rating else None,
                        review_count=d.review_count,
                        prakriti_affinities=d.prakriti_affinities or [],
                        languages=d.languages or [],
                        specialisations=d.specialisations or [],
                    )
                )

    # ── Products from matching clinics ────────────────────────────────────────
    if clinic_uuids:
        product_rows = (
            await db.execute(
                select(Product, ClinicFeatureStore)
                .join(ClinicFeatureStore, Product.clinic_id == ClinicFeatureStore.id)
                .where(
                    Product.clinic_id.in_(clinic_uuids),
                    Product.is_active.is_(True),
                )
                .order_by(
                    Product.is_gmp_certified.desc(),
                    Product.base_price.asc().nulls_last(),
                )
                .limit(8)
            )
        ).all()

        for p, c in product_rows:
            products.append(
                ProductBrief(
                    id=str(p.id),
                    slug=p.slug,
                    name=p.name,
                    description=p.description,
                    category=p.category,
                    base_price=float(p.base_price) if p.base_price else None,
                    currency=p.currency,
                    is_gmp_certified=p.is_gmp_certified,
                    clinic_name=c.name if c else None,
                    clinic_slug=c.slug if c else None,
                )
            )

    return treatments, doctors, clinics, products


# ── GET /api/search ───────────────────────────────────────────────────────────


@router.get("", response_model=SearchResponse)
async def full_text_search(
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    type: Literal["all", "doctor", "clinic"] = Query(default="all"),
    lang: str = Query(default="en", pattern="^(en|ar|de|fr|ml|hi)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Full-text search over doctor and clinic records using PostgreSQL tsvector.

    - Uses `plainto_tsquery` — safe for raw user input, no special operators needed.
    - Results ranked by `ts_rank`, then `tier desc`, then `rating desc`.
    - Logs every query to `search_events` for analytics.
    - `type=all` returns a combined ranked list; `type=doctor|clinic` restricts to one entity.
    """
    q = q.strip()
    tsquery = _tsq(q)

    # ── Doctor sub-query ──────────────────────────────────────────────────────
    doc_tv = _ts(_doctor_text())
    doc_q = (
        select(
            literal("doctor").label("type"),
            cast(Doctor.id, String).label("id"),
            Doctor.slug.label("slug"),
            Doctor.name.label("name"),
            cast(Doctor.tier, Integer).label("tier"),
            cast(Doctor.rating, Float).label("rating"),
            cast(null(), String).label("district"),
            Doctor.specialisations.label("specialisations"),
            _headline(_doctor_text(), tsquery).label("snippet"),
            func.ts_rank(doc_tv, tsquery).label("rank"),
        )
        .where(
            Doctor.is_active.is_(True),
            doc_tv.op("@@")(tsquery),
        )
    )

    # ── Clinic sub-query ──────────────────────────────────────────────────────
    clinic_tv = _ts(_clinic_text())
    clinic_q = (
        select(
            literal("clinic").label("type"),
            cast(ClinicFeatureStore.id, String).label("id"),
            ClinicFeatureStore.slug.label("slug"),
            ClinicFeatureStore.name.label("name"),
            cast(ClinicFeatureStore.tier, Integer).label("tier"),
            cast(ClinicFeatureStore.rating, Float).label("rating"),
            ClinicFeatureStore.district.label("district"),
            ClinicFeatureStore.specialisations.label("specialisations"),
            _headline(_clinic_text(), tsquery).label("snippet"),
            func.ts_rank(clinic_tv, tsquery).label("rank"),
        )
        .where(
            ClinicFeatureStore.is_active.is_(True),
            clinic_tv.op("@@")(tsquery),
        )
    )

    # ── Combine and paginate ──────────────────────────────────────────────────
    if type == "all":
        base = union_all(doc_q, clinic_q).subquery()
    elif type == "doctor":
        base = doc_q.subquery()
    else:
        base = clinic_q.subquery()

    count_col = func.count().over().label("_total")
    stmt = (
        select(base, count_col)
        .order_by(
            base.c.rank.desc(),
            base.c.tier.desc(),
            base.c.rating.desc().nulls_last(),
        )
        .limit(limit)
        .offset(offset)
    )

    rows = (await db.execute(stmt)).all()
    total = rows[0]._total if rows else 0

    results = [
        SearchResult(
            id=r.id,
            type=r.type,
            slug=r.slug,
            name=r.name,
            tier=r.tier,
            rating=r.rating,
            district=r.district,
            specialisations=r.specialisations or [],
            snippet=r.snippet or "",
        )
        for r in rows
    ]

    db.add(
        SearchEvent(
            id=uuid.uuid4(),
            query=q,
            search_type=type,
            results_count=total,
            lang=lang,
        )
    )

    return SearchResponse(results=results, total=total, query=q, type=type, lang=lang)


# ── GET /api/search/condition ─────────────────────────────────────────────────


@router.get("/condition", response_model=ConditionSearchResponse)
async def condition_search(
    q: str = Query(..., min_length=1, max_length=200, description="Condition name, e.g. 'back pain'"),
    lang: str = Query(default="en", pattern="^(en|ar|de|fr|ml|hi)$"),
    db: AsyncSession = Depends(get_db),
):
    """Map a plain-language health condition to Ayurvedic treatments, doctors, clinics, and medicines.

    - Matches `condition_name` (all languages) using case-insensitive fuzzy LIKE.
    - No LLM — purely static YAML-seeded lookup table.
    """
    q = q.strip()
    pattern = f"%{q}%"

    name_filter = [ConditionMap.condition_name.ilike(pattern)]
    if lang == "ar":
        name_filter.append(ConditionMap.condition_name_ar.ilike(pattern))
    elif lang == "ml":
        name_filter.append(ConditionMap.condition_name_ml.ilike(pattern))

    cond_row = (
        await db.execute(
            select(ConditionMap)
            .where(or_(*name_filter))
            .order_by(func.length(ConditionMap.condition_name).asc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if cond_row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No condition found matching '{q}'. Try a different spelling or browse conditions.",
        )

    treatments, doctors, clinics, products = await _resolve_condition_results(
        cond_row.treatment_slugs or [], db
    )
    explanation = _condition_explanations().get(cond_row.condition_slug)

    return ConditionSearchResponse(
        condition=ConditionOut(
            slug=cond_row.condition_slug,
            name=cond_row.condition_name,
            treatment_slugs=cond_row.treatment_slugs or [],
            explanation=explanation,
        ),
        treatments=treatments,
        doctors=doctors,
        clinics=clinics,
        products=products,
    )


# ── GET /api/search/condition/{slug} ─────────────────────────────────────────


@router.get("/condition/{slug}", response_model=ConditionSearchResponse)
async def get_condition_by_slug(
    slug: str,
    lang: str = Query(default="en", pattern="^(en|ar|de|fr|ml|hi)$"),
    db: AsyncSession = Depends(get_db),
):
    """Look up a condition page directly by its slug (e.g. 'stress-anxiety').

    Used by the /[lang]/conditions/[slug] frontend route.
    Identical response shape to /condition?q= but matches on condition_slug exactly.
    """
    cond_row = (
        await db.execute(
            select(ConditionMap).where(ConditionMap.condition_slug == slug)
        )
    ).scalar_one_or_none()

    if cond_row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Condition '{slug}' not found.",
        )

    treatments, doctors, clinics, products = await _resolve_condition_results(
        cond_row.treatment_slugs or [], db
    )
    explanation = _condition_explanations().get(slug)

    return ConditionSearchResponse(
        condition=ConditionOut(
            slug=cond_row.condition_slug,
            name=cond_row.condition_name,
            treatment_slugs=cond_row.treatment_slugs or [],
            explanation=explanation,
        ),
        treatments=treatments,
        doctors=doctors,
        clinics=clinics,
        products=products,
    )


# ── GET /api/search/suggestions ───────────────────────────────────────────────


@router.get("/suggestions", response_model=list[SuggestionItem])
async def autocomplete_suggestions(
    q: str = Query(..., min_length=1, max_length=100, description="Prefix to autocomplete"),
    lang: str = Query(default="en", pattern="^(en|ar|de|fr|ml|hi)$"),
    db: AsyncSession = Depends(get_db),
):
    """Autocomplete suggestions from doctors, clinics, treatments, and conditions.

    - Prefix-matches on name/condition_name using ILIKE 'q%'.
    - Returns up to 8 results, ranked by review_count proxy descending.
    - No search event logged (autocomplete noise would pollute analytics).
    """
    q = q.strip()
    prefix = f"{q}%"
    limit = 8

    doc_q = select(
        cast(Doctor.id, String).label("id"),
        literal("doctor").label("type"),
        Doctor.slug.label("slug"),
        Doctor.name.label("name"),
        Doctor.qualification.label("subtitle"),
        cast(Doctor.review_count, Integer).label("_rank"),
    ).where(
        Doctor.is_active.is_(True),
        Doctor.name.ilike(prefix),
    )

    clinic_q = select(
        cast(ClinicFeatureStore.id, String).label("id"),
        literal("clinic").label("type"),
        ClinicFeatureStore.slug.label("slug"),
        ClinicFeatureStore.name.label("name"),
        ClinicFeatureStore.district.label("subtitle"),
        cast(ClinicFeatureStore.review_count, Integer).label("_rank"),
    ).where(
        ClinicFeatureStore.is_active.is_(True),
        ClinicFeatureStore.name.ilike(prefix),
    )

    treatment_q = select(
        cast(Treatment.id, String).label("id"),
        literal("treatment").label("type"),
        Treatment.slug.label("slug"),
        Treatment.name.label("name"),
        cast(
            func.concat_ws("-", Treatment.duration_min_days, Treatment.duration_max_days),
            String,
        ).label("subtitle"),
        cast(literal(0), Integer).label("_rank"),
    ).where(
        Treatment.is_active.is_(True),
        Treatment.name.ilike(prefix),
    )

    cond_name_col = ConditionMap.condition_name
    if lang == "ar":
        cond_name_col = func.coalesce(ConditionMap.condition_name_ar, ConditionMap.condition_name)
    elif lang == "ml":
        cond_name_col = func.coalesce(ConditionMap.condition_name_ml, ConditionMap.condition_name)

    cond_q = select(
        cast(ConditionMap.id, String).label("id"),
        literal("condition").label("type"),
        ConditionMap.condition_slug.label("slug"),
        cond_name_col.label("name"),
        cast(
            func.concat(cast(func.cardinality(ConditionMap.treatment_slugs), String), " treatments"),
            String,
        ).label("subtitle"),
        cast(literal(0), Integer).label("_rank"),
    ).where(
        or_(
            ConditionMap.condition_name.ilike(prefix),
            ConditionMap.condition_name_ar.ilike(prefix) if lang == "ar" else ConditionMap.condition_name.ilike(prefix),
            ConditionMap.condition_name_ml.ilike(prefix) if lang == "ml" else ConditionMap.condition_name.ilike(prefix),
        )
    )

    combined = union_all(doc_q, clinic_q, treatment_q, cond_q).subquery()
    stmt = (
        select(combined)
        .order_by(combined.c._rank.desc())
        .limit(limit)
    )

    rows = (await db.execute(stmt)).all()

    return [
        SuggestionItem(
            id=r.id,
            type=r.type,
            slug=r.slug,
            name=r.name,
            subtitle=r.subtitle or None,
        )
        for r in rows
    ]

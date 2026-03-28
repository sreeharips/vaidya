"""
api/search.py — Search endpoints (clinic + package only).

GET /api/search?q=&lang=en
GET /api/search/suggestions?q=
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import Float, Integer, String, cast, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import ClinicFeatureStore, Retreat, SearchEvent

router = APIRouter(prefix="/api/search", tags=["search"])

_TS_LANG = "english"


class SearchResult(BaseModel):
    id: str
    slug: str
    name: str
    tier: int | None
    district: str | None
    specialisations: list[str] | None = None
    wellness_categories: list[str] | None = None


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int


class SuggestionItem(BaseModel):
    id: str
    type: str
    name: str
    subtitle: str | None


@router.get("", response_model=SearchResponse)
async def full_text_search(
    q: str = Query(..., min_length=1, max_length=200),
    type: str = Query(default="all"),  # all | clinic | package
    lang: str = Query(default="en"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    q = q.strip()
    pattern = f"%{q}%"
    results: list[SearchResult] = []

    # Search clinics if requested
    if type in ("all", "clinic"):
        clinic_rows = (await db.execute(
            select(ClinicFeatureStore).where(
                ClinicFeatureStore.is_active.is_(True),
                ClinicFeatureStore.name.ilike(pattern) |
                ClinicFeatureStore.district.ilike(pattern) |
                ClinicFeatureStore.description_en.ilike(pattern)
            ).order_by(ClinicFeatureStore.tier.desc(), ClinicFeatureStore.rating.desc().nulls_last())
        )).scalars().all()

        for c in clinic_rows:
            results.append(SearchResult(
                id=str(c.id),
                slug=c.slug,
                name=c.name,
                tier=c.tier,
                district=c.district,
                specialisations=c.specialisations or [],
                wellness_categories=c.wellness_categories or []
            ))

    # Search packages if requested
    if type in ("all", "package"):
        pkg_rows = (await db.execute(
            select(Retreat, ClinicFeatureStore)
            .join(ClinicFeatureStore, Retreat.clinic_id == ClinicFeatureStore.id)
            .where(
                Retreat.is_active.is_(True),
                ClinicFeatureStore.is_active.is_(True),
                Retreat.name.ilike(pattern) |
                Retreat.description_en.ilike(pattern)
            ).order_by(Retreat.price_usd.asc())
        )).all()

        for p, c in pkg_rows:
            results.append(SearchResult(
                id=str(p.id),
                slug=c.slug,
                name=p.name,
                tier=c.tier,
                district=c.district,
                specialisations=c.specialisations or [],
                wellness_categories=c.wellness_categories or []
            ))

    # Apply pagination
    total = len(results)
    results = results[offset:offset + limit]

    db.add(SearchEvent(id=uuid.uuid4(), query=q, search_type=type,
                       results_count=total, lang=lang))

    return SearchResponse(results=results, total=total)


@router.get("/suggestions", response_model=list[SuggestionItem])
async def autocomplete_suggestions(
    q: str = Query(..., min_length=1, max_length=100),
    lang: str = Query(default="en"),
    db: AsyncSession = Depends(get_db),
):
    q = q.strip()
    prefix = f"{q}%"

    clinic_rows = (await db.execute(
        select(ClinicFeatureStore).where(
            ClinicFeatureStore.is_active.is_(True),
            ClinicFeatureStore.name.ilike(prefix)
        ).limit(4)
    )).scalars().all()

    pkg_rows = (await db.execute(
        select(Retreat).where(
            Retreat.is_active.is_(True),
            Retreat.name.ilike(prefix)
        ).limit(4)
    )).scalars().all()

    results = [
        SuggestionItem(id=str(c.id), type="clinic", name=c.name, subtitle=c.district)
        for c in clinic_rows
    ] + [
        SuggestionItem(id=str(p.id), type="package", name=p.name,
                       subtitle=f"${float(p.price_usd):.0f}")
        for p in pkg_rows
    ]

    return results[:8]

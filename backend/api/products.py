"""
api/products.py — Herbal products listing across all clinics.

GET /api/products?category=&prakriti=&clinic_id=&gmp_only=&limit=12&offset=0
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import ClinicFeatureStore, Product, ProductVariant

router = APIRouter(prefix="/api/products", tags=["products"])


# ── Pydantic models ───────────────────────────────────────────────────────────


class ProductListItem(BaseModel):
    id: str
    slug: str
    name: str
    description: str | None
    category: str | None
    prakriti_tags: list[str]
    base_price: float | None
    lowest_price: float | None   # lowest active variant price, falls back to base_price
    currency: str
    photos: list[str]
    is_gmp_certified: bool
    clinic_id: str
    clinic_name: str
    clinic_slug: str


class ProductListResponse(BaseModel):
    items: list[ProductListItem]
    total: int
    limit: int
    offset: int


# ── GET /api/products ─────────────────────────────────────────────────────────


@router.get("", response_model=ProductListResponse)
async def list_products(
    category: str | None = Query(default=None, max_length=100),
    prakriti: str | None = Query(default=None, max_length=50),
    clinic_id: str | None = Query(default=None),
    gmp_only: bool = Query(default=False),
    limit: int = Query(default=12, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Paginated product listing across all active clinics.

    Includes the clinic name/slug for display. Lowest variant price is computed
    server-side so the frontend doesn't need to iterate variants.
    """
    base_where = [Product.is_active.is_(True), ClinicFeatureStore.is_active.is_(True)]

    if category:
        base_where.append(Product.category == category)
    if prakriti:
        base_where.append(prakriti == func.any(Product.prakriti_tags))
    if clinic_id:
        base_where.append(Product.clinic_id == clinic_id)
    if gmp_only:
        base_where.append(Product.is_gmp_certified.is_(True))

    # Base query joining Product → ClinicFeatureStore
    base_stmt = (
        select(Product, ClinicFeatureStore)
        .join(ClinicFeatureStore, Product.clinic_id == ClinicFeatureStore.id)
        .where(*base_where)
    )

    total = (
        await db.execute(
            select(func.count(Product.id))
            .join(ClinicFeatureStore, Product.clinic_id == ClinicFeatureStore.id)
            .where(*base_where)
        )
    ).scalar_one()

    rows = (
        await db.execute(
            base_stmt
            .order_by(Product.is_gmp_certified.desc(), Product.name.asc())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    # Fetch lowest active variant price for each product in one query
    product_ids = [p.id for p, _ in rows]
    lowest_prices: dict[str, float] = {}
    if product_ids:
        variant_rows = (
            await db.execute(
                select(ProductVariant.product_id, func.min(ProductVariant.price))
                .where(
                    ProductVariant.product_id.in_(product_ids),
                    ProductVariant.is_active.is_(True),
                )
                .group_by(ProductVariant.product_id)
            )
        ).all()
        for product_id, min_price in variant_rows:
            lowest_prices[str(product_id)] = float(min_price)

    items = [
        ProductListItem(
            id=str(p.id),
            slug=p.slug,
            name=p.name,
            description=p.description,
            category=p.category,
            prakriti_tags=p.prakriti_tags or [],
            base_price=float(p.base_price) if p.base_price is not None else None,
            lowest_price=lowest_prices.get(str(p.id)) or (float(p.base_price) if p.base_price else None),
            currency=p.currency,
            photos=p.photos or [],
            is_gmp_certified=p.is_gmp_certified,
            clinic_id=str(clinic.id),
            clinic_name=clinic.name,
            clinic_slug=clinic.slug,
        )
        for p, clinic in rows
    ]

    return ProductListResponse(items=items, total=total, limit=limit, offset=offset)

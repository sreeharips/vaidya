"""
api/admin/ecommerce.py — E-commerce settings and product management.

GET    /api/admin/ecommerce/products
POST   /api/admin/ecommerce/products
PATCH  /api/admin/ecommerce/products/{id}
DELETE /api/admin/ecommerce/products/{id}
PATCH  /api/admin/ecommerce/settings
GET    /api/admin/ecommerce/orders
"""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import ClinicFeatureStore, ClinicProduct, ProductPurchaseHistory

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class ProductOut(BaseModel):
    id: str
    name: str
    name_display_en: str | None
    name_display_ml: str | None
    name_display_ar: str | None
    description_en: str | None
    description_ml: str | None
    product_type: str
    sku: str
    price_usd: float
    price_inr: float | None
    stock_quantity: int
    is_prescription_only: bool
    is_active: bool
    ships_internationally: bool
    weight_grams: int | None
    prakriti_tags: list[str]


class ProductCreate(BaseModel):
    name: str
    name_display_en: str | None = None
    name_display_ml: str | None = None
    name_display_ar: str | None = None
    description_en: str | None = None
    description_ml: str | None = None
    product_type: str = "other"
    sku: str | None = None
    price_usd: float
    price_inr: float | None = None
    stock_quantity: int = 0
    is_prescription_only: bool = True
    is_active: bool = False
    ships_internationally: bool = False
    weight_grams: int | None = None
    prakriti_tags: list[str] = []


class ProductUpdate(BaseModel):
    name: str | None = None
    name_display_en: str | None = None
    name_display_ml: str | None = None
    name_display_ar: str | None = None
    description_en: str | None = None
    description_ml: str | None = None
    product_type: str | None = None
    price_usd: float | None = None
    price_inr: float | None = None
    stock_quantity: int | None = None
    is_prescription_only: bool | None = None
    is_active: bool | None = None
    ships_internationally: bool | None = None
    weight_grams: int | None = None
    prakriti_tags: list[str] | None = None


class EcommerceSettingsUpdate(BaseModel):
    ecommerce_enabled: bool | None = None
    shipping_policy: str | None = None
    return_policy: str | None = None


class OrderOut(BaseModel):
    id: str
    product_name: str
    quantity: int
    total_price: float
    currency: str
    status: str
    ordered_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_sku(name: str) -> str:
    """Auto-generate SKU from product name."""
    slug = re.sub(r"[^a-zA-Z0-9]", "", name.upper().replace(" ", ""))[:8]
    return f"{slug}-{uuid.uuid4().hex[:4].upper()}"


def _product_to_out(p: ClinicProduct) -> ProductOut:
    return ProductOut(
        id=str(p.id),
        name=p.name,
        name_display_en=p.name_display_en,
        name_display_ml=p.name_display_ml,
        name_display_ar=p.name_display_ar,
        description_en=p.description_en,
        description_ml=p.description_ml,
        product_type=p.product_type,
        sku=p.sku,
        price_usd=float(p.price_usd),
        price_inr=float(p.price_inr) if p.price_inr else None,
        stock_quantity=p.stock_quantity,
        is_prescription_only=p.is_prescription_only,
        is_active=p.is_active,
        ships_internationally=p.ships_internationally,
        weight_grams=p.weight_grams,
        prakriti_tags=p.prakriti_tags or [],
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/ecommerce/products", response_model=list[ProductOut])
async def list_products(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClinicProduct).where(ClinicProduct.clinic_id == clinic.id).order_by(ClinicProduct.name)
    )
    return [_product_to_out(p) for p in result.scalars().all()]


@router.post("/ecommerce/products", response_model=ProductOut, status_code=201)
async def create_product(
    body: ProductCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    sku = body.sku or _generate_sku(body.name)

    # Check SKU uniqueness
    existing = (await db.execute(
        select(ClinicProduct).where(ClinicProduct.sku == sku)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"SKU '{sku}' already exists")

    product = ClinicProduct(
        clinic_id=clinic.id,
        name=body.name,
        name_display_en=body.name_display_en,
        name_display_ml=body.name_display_ml,
        name_display_ar=body.name_display_ar,
        description_en=body.description_en,
        description_ml=body.description_ml,
        product_type=body.product_type,
        sku=sku,
        price_usd=body.price_usd,
        price_inr=body.price_inr,
        stock_quantity=body.stock_quantity,
        is_prescription_only=body.is_prescription_only,
        is_active=body.is_active,
        ships_internationally=body.ships_internationally,
        weight_grams=body.weight_grams,
        prakriti_tags=body.prakriti_tags,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return _product_to_out(product)


@router.patch("/ecommerce/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str,
    body: ProductUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(ClinicProduct, uuid.UUID(product_id))
    if not product or product.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Product not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    product.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(product)
    return _product_to_out(product)


@router.delete("/ecommerce/products/{product_id}")
async def delete_product(
    product_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(ClinicProduct, uuid.UUID(product_id))
    if not product or product.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    product.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": product_id, "is_active": False}


@router.patch("/ecommerce/settings")
async def update_ecommerce_settings(
    body: EcommerceSettingsUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    if body.ecommerce_enabled is not None:
        clinic.ecommerce_enabled = body.ecommerce_enabled
    if body.shipping_policy is not None:
        clinic.shipping_policy = body.shipping_policy
    if body.return_policy is not None:
        clinic.return_policy = body.return_policy
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {
        "ecommerce_enabled": clinic.ecommerce_enabled,
        "shipping_policy": clinic.shipping_policy,
        "return_policy": clinic.return_policy,
    }


@router.get("/ecommerce/orders", response_model=list[OrderOut])
async def list_orders(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Return product purchase history for products belonging to this clinic's catalogue."""
    # Get clinic product slugs
    products = (await db.execute(
        select(ClinicProduct.name).where(ClinicProduct.clinic_id == clinic.id)
    )).scalars().all()
    product_names = set(products)

    if not product_names:
        return []

    # Query purchase history matching these product names
    purchases = (await db.execute(
        select(ProductPurchaseHistory).where(
            ProductPurchaseHistory.product_name.in_(product_names)
        ).order_by(ProductPurchaseHistory.ordered_at.desc()).limit(50)
    )).scalars().all()

    return [
        OrderOut(
            id=str(p.id),
            product_name=p.product_name,
            quantity=p.quantity,
            total_price=float(p.total_price),
            currency=p.currency,
            status=p.status,
            ordered_at=p.ordered_at.isoformat(),
        )
        for p in purchases
    ]

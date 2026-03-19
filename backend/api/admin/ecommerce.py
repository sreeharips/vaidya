"""
api/admin/ecommerce.py — Herbal product management for clinic admins.

All endpoints operate on the `products` + `product_variants` tables —
the same tables that drive the public clinic page's herbal shop section.

GET    /api/admin/ecommerce/settings
PATCH  /api/admin/ecommerce/settings
GET    /api/admin/ecommerce/products
POST   /api/admin/ecommerce/products
PATCH  /api/admin/ecommerce/products/{id}
DELETE /api/admin/ecommerce/products/{id}
GET    /api/admin/ecommerce/orders
"""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.admin_auth import get_admin_clinic
from db.database import get_db
from db.models import ClinicFeatureStore, Product, ProductVariant

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class VariantIn(BaseModel):
    label: str
    sku: str | None = None
    price: float
    stock_qty: int = 0
    weight_grams: int | None = None


class VariantOut(BaseModel):
    id: str
    label: str
    sku: str | None
    price: float
    stock_qty: int
    weight_grams: int | None
    is_active: bool


class ProductOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str | None
    category: str | None
    prakriti_tags: list[str]
    base_price: float | None
    currency: str
    photos: list[str]
    is_gmp_certified: bool
    is_active: bool
    variants: list[VariantOut]


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    category: str | None = None
    prakriti_tags: list[str] = []
    base_price: float | None = None
    currency: str = "INR"
    is_gmp_certified: bool = False
    is_active: bool = True
    variants: list[VariantIn] = []


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    prakriti_tags: list[str] | None = None
    base_price: float | None = None
    currency: str | None = None
    is_gmp_certified: bool | None = None
    is_active: bool | None = None
    variants: list[VariantIn] | None = None  # full replace of variants


class EcommerceSettingsUpdate(BaseModel):
    ecommerce_enabled: bool | None = None
    shipping_policy: str | None = None
    return_policy: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


def _variant_to_out(v: ProductVariant) -> VariantOut:
    return VariantOut(
        id=str(v.id),
        label=v.label,
        sku=v.sku,
        price=float(v.price),
        stock_qty=v.stock_qty,
        weight_grams=v.weight_grams,
        is_active=v.is_active,
    )


def _product_to_out(p: Product) -> ProductOut:
    return ProductOut(
        id=str(p.id),
        slug=p.slug,
        name=p.name,
        description=p.description,
        category=p.category,
        prakriti_tags=p.prakriti_tags or [],
        base_price=float(p.base_price) if p.base_price else None,
        currency=p.currency,
        photos=p.photos or [],
        is_gmp_certified=p.is_gmp_certified,
        is_active=p.is_active,
        variants=[_variant_to_out(v) for v in (p.variants or []) if v.is_active],
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/ecommerce/settings")
async def get_ecommerce_settings(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
):
    return {
        "ecommerce_enabled": clinic.ecommerce_enabled,
        "shipping_policy": clinic.shipping_policy,
        "return_policy": clinic.return_policy,
    }


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


@router.get("/ecommerce/products", response_model=list[ProductOut])
async def list_products(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.clinic_id == clinic.id)
        .order_by(Product.category.asc().nulls_last(), Product.name.asc())
    )).scalars().all()
    return [_product_to_out(p) for p in rows]


@router.post("/ecommerce/products", response_model=ProductOut, status_code=201)
async def create_product(
    body: ProductCreate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    slug = _slugify(body.name)
    product = Product(
        clinic_id=clinic.id,
        slug=slug,
        name=body.name,
        description=body.description,
        category=body.category,
        prakriti_tags=body.prakriti_tags,
        base_price=body.base_price,
        currency=body.currency,
        is_gmp_certified=body.is_gmp_certified,
        is_active=body.is_active,
        photos=[],
    )
    db.add(product)
    await db.flush()  # get product.id

    for v in body.variants:
        db.add(ProductVariant(
            product_id=product.id,
            label=v.label,
            sku=v.sku,
            price=v.price,
            stock_qty=v.stock_qty,
            weight_grams=v.weight_grams,
        ))

    await db.commit()
    product = (await db.execute(
        select(Product).options(selectinload(Product.variants)).where(Product.id == product.id)
    )).scalar_one()
    return _product_to_out(product)


@router.patch("/ecommerce/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str,
    body: ProductUpdate,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, uuid.UUID(product_id))
    if not product or product.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Product not found")

    data = body.model_dump(exclude_unset=True)
    variants_data = data.pop("variants", None)

    for field, value in data.items():
        setattr(product, field, value)
    product.updated_at = datetime.now(timezone.utc)

    # Full replace of variants if provided
    if variants_data is not None:
        existing = (await db.execute(
            select(ProductVariant).where(ProductVariant.product_id == product.id)
        )).scalars().all()
        for ev in existing:
            await db.delete(ev)
        for v in variants_data:
            db.add(ProductVariant(
                product_id=product.id,
                label=v["label"],
                sku=v.get("sku"),
                price=v["price"],
                stock_qty=v.get("stock_qty", 0),
                weight_grams=v.get("weight_grams"),
            ))

    await db.commit()
    product = (await db.execute(
        select(Product).options(selectinload(Product.variants)).where(Product.id == product.id)
    )).scalar_one()
    return _product_to_out(product)


@router.delete("/ecommerce/products/{product_id}")
async def delete_product(
    product_id: str,
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, uuid.UUID(product_id))
    if not product or product.clinic_id != clinic.id:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    product.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": product_id, "is_active": False}


@router.get("/ecommerce/orders")
async def list_orders(
    clinic: ClinicFeatureStore = Depends(get_admin_clinic),
    db: AsyncSession = Depends(get_db),
):
    """Return product orders for this clinic (via product_orders table)."""
    from db.models import ProductOrder, OrderItem
    orders = (await db.execute(
        select(ProductOrder)
        .where(ProductOrder.clinic_id == clinic.id)
        .order_by(ProductOrder.created_at.desc())
        .limit(50)
    )).scalars().all()

    result = []
    for o in orders:
        items = (await db.execute(
            select(OrderItem).where(OrderItem.order_id == o.id)
        )).scalars().all()
        result.append({
            "id": str(o.id),
            "status": o.status,
            "total_amount": float(o.total_amount) if o.total_amount else 0.0,
            "currency": o.currency,
            "ordered_at": o.created_at.isoformat(),
            "items": [
                {
                    "product_name": item.product_name_snapshot,
                    "quantity": item.quantity,
                    "price": float(item.unit_price),
                }
                for item in items
            ],
        })
    return result

"""ecommerce and treatment ownership

Revision ID: c3d4e5f6a7b8
Revises: b9c2d1e3f4a5
Create Date: 2026-03-16 14:00:00.000000

Changes:
  1. treatments.doctor_id dropped — treatment ownership moves to Clinic only.
     Which doctors deliver a treatment is now in doctor_treatments junction.
  2. treatments.clinic_id made NOT NULL — a treatment must belong to a clinic.
  3. doctor_treatments junction table created (doctor ↔ treatment many-to-many).
  4. products table created (herbal products owned by clinic).
  5. product_variants table created (size/form variants of a product).
  6. product_orders table created (patient medicine orders, clinic ships directly).
  7. order_items table created (line items within a product order).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b9c2d1e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Fix treatments ownership ──────────────────────────────────────────
    # Before dropping doctor_id, backfill any NULL clinic_id rows so that the
    # NOT NULL constraint below never fails on a non-empty database.
    op.execute("""
        UPDATE treatments
        SET clinic_id = (SELECT id FROM clinic_feature_store LIMIT 1)
        WHERE clinic_id IS NULL
          AND EXISTS (SELECT 1 FROM clinic_feature_store LIMIT 1)
    """)

    # Drop the doctor_id FK constraint and index, then the column.
    op.drop_constraint("treatments_doctor_id_fkey", "treatments", type_="foreignkey")
    op.drop_index("ix_treatments_doctor_id", table_name="treatments")
    op.drop_column("treatments", "doctor_id")

    # Make clinic_id NOT NULL now that we've filled any gaps.
    op.alter_column("treatments", "clinic_id", nullable=False)

    # ── 2. doctor_treatments junction ────────────────────────────────────────
    op.create_table(
        "doctor_treatments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "doctor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "treatment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("treatments.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("is_primary", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("doctor_id", "treatment_id", name="uq_doctor_treatment"),
    )

    # ── 3. products ──────────────────────────────────────────────────────────
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "clinic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clinic_feature_store.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("slug", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("category", sa.String(100)),   # oils | churnas | lehyas | capsules | external | decoctions
        sa.Column("prakriti_tags", postgresql.ARRAY(sa.String)),
        sa.Column("base_price", sa.Numeric(10, 2)),
        sa.Column("currency", sa.String(3), server_default="INR"),
        sa.Column("photos", postgresql.ARRAY(sa.String)),
        sa.Column("is_gmp_certified", sa.Boolean, server_default="false"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── 4. product_variants ───────────────────────────────────────────────────
    op.create_table(
        "product_variants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("label", sa.String(100), nullable=False),   # e.g. "100g", "250ml", "30 capsules"
        sa.Column("sku", sa.String(100), unique=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("stock_qty", sa.Integer, server_default="0"),
        sa.Column("weight_grams", sa.Integer),                # for shipping cost calc
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("product_id", "label", name="uq_product_variant_label"),
    )

    # ── 5. product_orders ─────────────────────────────────────────────────────
    op.create_table(
        "product_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "patient_pseudo_id",
            sa.String(64),
            sa.ForeignKey("patient_profiles.pseudo_id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "clinic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clinic_feature_store.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bookings.id"),
            nullable=True,
            index=True,
        ),
        sa.Column("status", sa.String(30), server_default="pending"),
        sa.Column("total_amount", sa.Numeric(10, 2)),
        sa.Column("currency", sa.String(3), server_default="INR"),
        sa.Column("payment_ref", sa.String(255)),
        sa.Column("stripe_session_id", sa.String(255)),
        sa.Column("razorpay_order_id", sa.String(255)),
        sa.Column("shipping_address", postgresql.JSONB),
        sa.Column("tracking_number", sa.String(255)),
        sa.Column("dispatched_at", sa.DateTime(timezone=True)),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint(
            "status IN ('pending','paid','dispatched','delivered','cancelled','refunded')",
            name="ck_product_order_status",
        ),
    )

    # ── 6. order_items ────────────────────────────────────────────────────────
    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_orders.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "variant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_variants.id"),
            nullable=True,
            index=True,
        ),
        sa.Column("quantity", sa.Integer, nullable=False),
        # Price snapshots — must not change if the variant price is updated later
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_order_item_quantity_positive"),
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("order_items")
    op.drop_table("product_orders")
    op.drop_table("product_variants")
    op.drop_table("products")
    op.drop_table("doctor_treatments")

    # Restore treatments.doctor_id (nullable — original state)
    op.add_column(
        "treatments",
        sa.Column(
            "doctor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_treatments_doctor_id", "treatments", ["doctor_id"])

    # Restore treatments.clinic_id to nullable
    op.alter_column("treatments", "clinic_id", nullable=True)

"""admin portal schema

Revision ID: g7h8i9j0k1l2
Revises: a1b2c3d4e5f6
Create Date: 2026-03-18 12:00:00.000000

Changes:
  1. clinic_feature_store — add admin_user_id, description_ml/ar, address fields,
     operating_hours, social_links, pickup_available/locations, ecommerce_enabled,
     shipping_policy, return_policy
  2. doctors — add name_ml, name_ar, bio_ml, bio_ar, gender, consultation_fee_usd,
     doctor_certifications
  3. CREATE TABLE clinic_images
  4. CREATE TABLE booking_slots
  5. CREATE TABLE clinic_products
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "g7h8i9j0k1l2"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- 1. clinic_feature_store new columns --
    op.add_column("clinic_feature_store", sa.Column("admin_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("description_en", sa.Text(), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("description_ml", sa.Text(), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("description_ar", sa.Text(), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("address_line1", sa.String(255), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("address_line2", sa.String(255), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("state", sa.String(100), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("pincode", sa.String(10), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("phone", sa.String(30), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("email", sa.String(320), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("website_url", sa.String(512), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("operating_hours", JSONB, nullable=True))
    op.add_column("clinic_feature_store", sa.Column("social_links", JSONB, nullable=True))
    op.add_column("clinic_feature_store", sa.Column("pickup_available", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("clinic_feature_store", sa.Column("pickup_locations", sa.ARRAY(sa.String()), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("ecommerce_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("clinic_feature_store", sa.Column("shipping_policy", sa.Text(), nullable=True))
    op.add_column("clinic_feature_store", sa.Column("return_policy", sa.Text(), nullable=True))
    op.create_index("ix_clinic_feature_store_admin_user_id", "clinic_feature_store", ["admin_user_id"])

    # -- 2. doctors new columns --
    op.add_column("doctors", sa.Column("name_ml", sa.String(255), nullable=True))
    op.add_column("doctors", sa.Column("name_ar", sa.String(255), nullable=True))
    op.add_column("doctors", sa.Column("bio_ml", sa.Text(), nullable=True))
    op.add_column("doctors", sa.Column("bio_ar", sa.Text(), nullable=True))
    op.add_column("doctors", sa.Column("gender", sa.String(10), nullable=True))
    op.add_column("doctors", sa.Column("consultation_fee_usd", sa.Numeric(10, 2), nullable=True))
    op.add_column("doctors", sa.Column("doctor_certifications", JSONB, nullable=True))

    # -- 3. clinic_images --
    op.create_table(
        "clinic_images",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), nullable=False),
        sa.Column("doctor_id", UUID(as_uuid=True), sa.ForeignKey("doctors.id"), nullable=True),
        sa.Column("image_type", sa.String(30), nullable=False),
        sa.Column("s3_key", sa.String(512), nullable=False),
        sa.Column("s3_url", sa.String(1024), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("alt_text", sa.String(500), nullable=True),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "image_type IN ('clinic_hero','clinic_gallery','clinic_logo','doctor_profile','doctor_gallery','treatment','certificate','room')",
            name="ck_clinic_image_type",
        ),
    )
    op.create_index("ix_clinic_images_clinic_id", "clinic_images", ["clinic_id"])
    op.create_index("ix_clinic_images_doctor_id", "clinic_images", ["doctor_id"])

    # -- 4. booking_slots --
    op.create_table(
        "booking_slots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), nullable=False),
        sa.Column("doctor_id", UUID(as_uuid=True), sa.ForeignKey("doctors.id"), nullable=True),
        sa.Column("treatment_id", UUID(as_uuid=True), sa.ForeignKey("treatments.id"), nullable=True),
        sa.Column("slot_type", sa.String(20), nullable=False),
        sa.Column("recurrence", JSONB, nullable=True),
        sa.Column("date", sa.Date(), nullable=True),
        sa.Column("start_time", sa.String(5), nullable=False),
        sa.Column("end_time", sa.String(5), nullable=False),
        sa.Column("max_bookings", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("current_bookings", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "slot_type IN ('recurring','single','blocked')",
            name="ck_booking_slot_type",
        ),
    )
    op.create_index("ix_booking_slots_clinic_id", "booking_slots", ["clinic_id"])
    op.create_index("ix_booking_slots_doctor_id", "booking_slots", ["doctor_id"])
    op.create_index("ix_booking_slots_date", "booking_slots", ["clinic_id", "date"])

    # -- 5. clinic_products --
    op.create_table(
        "clinic_products",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("name_display_en", sa.String(255), nullable=True),
        sa.Column("name_display_ml", sa.String(255), nullable=True),
        sa.Column("name_display_ar", sa.String(255), nullable=True),
        sa.Column("description_en", sa.Text(), nullable=True),
        sa.Column("description_ml", sa.Text(), nullable=True),
        sa.Column("product_type", sa.String(30), server_default=sa.text("'other'"), nullable=False),
        sa.Column("sku", sa.String(100), unique=True, nullable=False),
        sa.Column("price_usd", sa.Numeric(10, 2), nullable=False),
        sa.Column("price_inr", sa.Numeric(10, 2), nullable=True),
        sa.Column("stock_quantity", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_prescription_only", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("ships_internationally", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("weight_grams", sa.Integer(), nullable=True),
        sa.Column("image_id", UUID(as_uuid=True), sa.ForeignKey("clinic_images.id"), nullable=True),
        sa.Column("prakriti_tags", sa.ARRAY(sa.String()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "product_type IN ('kashayam','arishtam','ghritam','tailam','churnam','lehyam','bhasma','tablet','capsule','other')",
            name="ck_clinic_product_type",
        ),
    )
    op.create_index("ix_clinic_products_clinic_id", "clinic_products", ["clinic_id"])


def downgrade() -> None:
    op.drop_table("clinic_products")
    op.drop_table("booking_slots")
    op.drop_table("clinic_images")

    # doctors columns
    op.drop_column("doctors", "doctor_certifications")
    op.drop_column("doctors", "consultation_fee_usd")
    op.drop_column("doctors", "gender")
    op.drop_column("doctors", "bio_ar")
    op.drop_column("doctors", "bio_ml")
    op.drop_column("doctors", "name_ar")
    op.drop_column("doctors", "name_ml")

    # clinic_feature_store columns
    op.drop_index("ix_clinic_feature_store_admin_user_id", "clinic_feature_store")
    op.drop_column("clinic_feature_store", "return_policy")
    op.drop_column("clinic_feature_store", "shipping_policy")
    op.drop_column("clinic_feature_store", "ecommerce_enabled")
    op.drop_column("clinic_feature_store", "pickup_locations")
    op.drop_column("clinic_feature_store", "pickup_available")
    op.drop_column("clinic_feature_store", "social_links")
    op.drop_column("clinic_feature_store", "operating_hours")
    op.drop_column("clinic_feature_store", "website_url")
    op.drop_column("clinic_feature_store", "email")
    op.drop_column("clinic_feature_store", "phone")
    op.drop_column("clinic_feature_store", "pincode")
    op.drop_column("clinic_feature_store", "state")
    op.drop_column("clinic_feature_store", "address_line2")
    op.drop_column("clinic_feature_store", "address_line1")
    op.drop_column("clinic_feature_store", "description_ar")
    op.drop_column("clinic_feature_store", "description_ml")
    op.drop_column("clinic_feature_store", "description_en")
    op.drop_column("clinic_feature_store", "admin_user_id")

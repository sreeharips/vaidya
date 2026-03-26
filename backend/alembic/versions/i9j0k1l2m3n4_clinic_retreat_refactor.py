"""clinic retreat refactor — doctor-marketplace to clinic-based wellness retreat booking

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-03-26 10:00:00.000000

This migration refactors the database from a doctor-marketplace model to a
clinic-based wellness retreat booking platform. It removes doctor-centric
tables and columns, introduces wellness packages and clinic team, and updates
constraints to reflect the new domain model.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # =========================================================================
    # Step 1 — Drop FK references first
    # =========================================================================

    # bookings.doctor_id
    op.drop_constraint("bookings_doctor_id_fkey", "bookings", type_="foreignkey")
    op.drop_column("bookings", "doctor_id")

    # reviews.doctor_id
    op.drop_constraint("reviews_doctor_id_fkey", "reviews", type_="foreignkey")
    op.drop_column("reviews", "doctor_id")

    # clinic_images.doctor_id
    op.drop_constraint("clinic_images_doctor_id_fkey", "clinic_images", type_="foreignkey")
    op.drop_column("clinic_images", "doctor_id")

    # bookings.treatment_id
    op.drop_constraint("bookings_treatment_id_fkey", "bookings", type_="foreignkey")
    op.drop_column("bookings", "treatment_id")

    # booking_history.doctor_id (must drop before doctors table is removed)
    op.drop_constraint("booking_history_doctor_id_fkey", "booking_history", type_="foreignkey")
    op.drop_column("booking_history", "doctor_id")

    # =========================================================================
    # Step 2 — Drop tables (in dependency-safe order)
    # =========================================================================

    op.drop_table("voice_sessions")
    op.drop_table("clinic_products")
    op.drop_table("conditions_map")
    op.drop_table("treatment_kb")
    op.drop_table("booking_slots")
    op.drop_table("doctor_treatments")
    op.drop_table("clinic_availability_slots")
    op.drop_table("product_purchase_history")
    op.drop_table("prescriptions")
    op.drop_table("consultation_history")
    op.drop_table("order_items")
    op.drop_table("product_orders")
    op.drop_table("product_variants")
    op.drop_table("products")
    op.drop_table("treatments")
    op.drop_table("doctors")

    # =========================================================================
    # Step 3 — Modify surviving tables
    # =========================================================================

    # -- clinic_feature_store --
    # Remove prakriti_affinities, add wellness_categories
    op.drop_column("clinic_feature_store", "prakriti_affinities")
    op.add_column(
        "clinic_feature_store",
        sa.Column("wellness_categories", sa.ARRAY(sa.Text()), server_default="{}", nullable=True),
    )

    # -- bookings: add guest_name, guest_count --
    op.add_column("bookings", sa.Column("guest_name", sa.String(255), nullable=True))
    op.add_column(
        "bookings",
        sa.Column("guest_count", sa.Integer(), server_default=sa.text("1"), nullable=True),
    )

    # -- clinic_images: replace image_type check constraint --
    op.execute("ALTER TABLE clinic_images DROP CONSTRAINT IF EXISTS ck_clinic_image_type")
    op.execute(
        "ALTER TABLE clinic_images ADD CONSTRAINT ck_clinic_image_type "
        "CHECK (image_type IN ('clinic_hero','clinic_gallery','clinic_logo','room','treatment','team_photo'))"
    )

    # -- users: update role check constraint --
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role")
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT ck_users_role "
        "CHECK (role IN ('patient','clinic_admin','platform_admin'))"
    )

    # -- user_watchlist: update entity_type check constraint --
    op.execute("ALTER TABLE user_watchlist DROP CONSTRAINT IF EXISTS ck_watchlist_entity_type")
    op.execute(
        "ALTER TABLE user_watchlist ADD CONSTRAINT ck_watchlist_entity_type "
        "CHECK (entity_type IN ('clinic'))"
    )

    # -- booking_history: rename treatment_name → package_name --
    op.alter_column("booking_history", "treatment_name", new_column_name="package_name")

    # -- outcomes_log: drop doctor_id --
    op.drop_column("outcomes_log", "doctor_id")

    # =========================================================================
    # Step 4 — Create new tables
    # =========================================================================

    # -- clinic_team --
    op.create_table(
        "clinic_team",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("name_ml", sa.String(255), nullable=True),
        sa.Column("name_ar", sa.String(255), nullable=True),
        sa.Column("qualification", sa.String(255), nullable=True),
        sa.Column("years_experience", sa.Integer(), nullable=True),
        sa.Column("bio_en", sa.Text(), nullable=True),
        sa.Column("bio_ml", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default=sa.text("0"), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )

    # -- wellness_packages --
    op.create_table(
        "wellness_packages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("name_display_en", sa.String(255), nullable=True),
        sa.Column("name_display_ar", sa.String(255), nullable=True),
        sa.Column("name_display_ml", sa.String(255), nullable=True),
        sa.Column("description_en", sa.Text(), nullable=True),
        sa.Column("description_ar", sa.Text(), nullable=True),
        sa.Column("description_ml", sa.Text(), nullable=True),
        sa.Column("package_type", sa.String(255), nullable=False),
        sa.Column("wellness_categories", sa.ARRAY(sa.Text()), server_default="{}", nullable=True),
        sa.Column("duration_min_days", sa.Integer(), nullable=False),
        sa.Column("duration_max_days", sa.Integer(), nullable=False),
        sa.Column("price_usd", sa.Numeric(10, 2), nullable=False),
        sa.Column("price_inr", sa.Numeric(10, 2), nullable=True),
        sa.Column("includes_accommodation", sa.Boolean(), server_default=sa.text("false"), nullable=True),
        sa.Column("includes_meals", sa.Boolean(), server_default=sa.text("false"), nullable=True),
        sa.Column("includes_transfers", sa.Boolean(), server_default=sa.text("false"), nullable=True),
        sa.Column("max_guests_per_slot", sa.Integer(), server_default=sa.text("1"), nullable=True),
        sa.Column("what_to_expect", sa.Text(), nullable=True),
        sa.Column("contraindications", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default=sa.text("0"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )

    # -- package_availability --
    op.create_table(
        "package_availability",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("package_id", UUID(as_uuid=True), sa.ForeignKey("wellness_packages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("available_spots", sa.Integer(), server_default=sa.text("1"), nullable=True),
        sa.Column("is_blocked", sa.Boolean(), server_default=sa.text("false"), nullable=True),
        sa.Column("block_reason", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.UniqueConstraint("package_id", "date", name="uq_package_availability_date"),
    )

    # =========================================================================
    # Step 5 — Add FK from bookings to wellness_packages
    # =========================================================================

    op.add_column("bookings", sa.Column("package_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "bookings_package_id_fkey",
        "bookings",
        "wellness_packages",
        ["package_id"],
        ["id"],
    )


def downgrade() -> None:
    pass

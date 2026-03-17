"""user identity guest first

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-17 12:00:00.000000

Changes:
  1. users table — auth + role, SSO placeholders, login optional
  2. guest_sessions — session_id in cookie, claimed_by_user_id on login
  3. user_preferences — one row per user OR guest (CHECK: at least one owner)
  4. user_watchlist — saved clinics/doctors for user or guest
  5. booking_history — user-facing booking view, user_id nullable
  6. consultation_history — doctor consultations, user_id nullable
  7. prescriptions — structured prescription data, user_id nullable
  8. product_purchase_history — medicine purchases, user_id nullable
  9. bookings table gains session_id + guest_email columns
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- 1. users --
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(320), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("phone", sa.String(30)),
        sa.Column("preferred_language", sa.String(5), server_default="en", nullable=False),
        sa.Column("role", sa.String(20), server_default="patient", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_email_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("email_verification_token", sa.String(255)),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("sso_provider", sa.String(20)),
        sa.Column("sso_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "role IN ('patient','doctor','clinic_admin','platform_admin')",
            name="ck_users_role",
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # -- 2. guest_sessions --
    op.create_table(
        "guest_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("claimed_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("preferred_language", sa.String(5), server_default="en", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), server_default=sa.text("now() + interval '90 days'"), nullable=False),
    )
    op.create_index(
        "ix_guest_sessions_claimed_user",
        "guest_sessions",
        ["claimed_by_user_id"],
        postgresql_where=sa.text("claimed_by_user_id IS NOT NULL"),
    )

    # -- 3. user_preferences --
    op.create_table(
        "user_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("guest_sessions.id")),
        sa.Column("prakriti_vata_pct", sa.Integer()),
        sa.Column("prakriti_pitta_pct", sa.Integer()),
        sa.Column("prakriti_kapha_pct", sa.Integer()),
        sa.Column("prakriti_primary_type", sa.String(32)),
        sa.Column("prakriti_secondary_type", sa.String(32)),
        sa.Column("prakriti_completed_at", sa.DateTime(timezone=True)),
        sa.Column("prakriti_assessment_id", UUID(as_uuid=True), sa.ForeignKey("outcomes_log.id")),
        sa.Column("preferred_treatment_types", sa.ARRAY(sa.String())),
        sa.Column("preferred_doctor_languages", sa.ARRAY(sa.String())),
        sa.Column("preferred_budget_max", sa.Integer()),
        sa.Column("preferred_districts", sa.ARRAY(sa.String())),
        sa.Column("content_personalisation_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "user_id IS NOT NULL OR session_id IS NOT NULL",
            name="ck_user_prefs_owner",
        ),
    )
    op.create_index(
        "ix_user_preferences_user_id", "user_preferences", ["user_id"],
        unique=True, postgresql_where=sa.text("user_id IS NOT NULL"),
    )
    op.create_index(
        "ix_user_preferences_session_id", "user_preferences", ["session_id"],
        unique=True, postgresql_where=sa.text("session_id IS NOT NULL"),
    )

    # -- 4. user_watchlist --
    op.create_table(
        "user_watchlist",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("guest_sessions.id")),
        sa.Column("entity_type", sa.String(10), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("notes", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "user_id IS NOT NULL OR session_id IS NOT NULL",
            name="ck_watchlist_owner",
        ),
        sa.CheckConstraint("entity_type IN ('clinic','doctor')", name="ck_watchlist_entity_type"),
        sa.UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_watchlist_user"),
        sa.UniqueConstraint("session_id", "entity_type", "entity_id", name="uq_watchlist_session"),
    )
    op.create_index(
        "ix_user_watchlist_user", "user_watchlist", ["user_id", "entity_type"],
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )
    op.create_index(
        "ix_user_watchlist_session", "user_watchlist", ["session_id", "entity_type"],
        postgresql_where=sa.text("session_id IS NOT NULL"),
    )

    # -- 5. booking_history --
    op.create_table(
        "booking_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("guest_sessions.id")),
        sa.Column("booking_id", UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), nullable=False),
        sa.Column("doctor_id", UUID(as_uuid=True), sa.ForeignKey("doctors.id"), nullable=False),
        sa.Column("treatment_name", sa.String(255), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("total_paid", sa.Numeric(10, 2)),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_booking_history_booking", "booking_history", ["booking_id"])
    op.create_index(
        "ix_booking_history_user", "booking_history", ["user_id"],
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )
    op.create_index(
        "ix_booking_history_session", "booking_history", ["session_id"],
        postgresql_where=sa.text("session_id IS NOT NULL"),
    )

    # -- 6. consultation_history --
    op.create_table(
        "consultation_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("guest_sessions.id")),
        sa.Column("doctor_id", UUID(as_uuid=True), sa.ForeignKey("doctors.id"), nullable=False),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), nullable=False),
        sa.Column("consultation_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("chief_complaint_en", sa.Text()),
        sa.Column("chief_complaint_original", sa.Text()),
        sa.Column("prakriti_at_consultation", sa.String(32)),
        sa.Column("notes_en", sa.Text()),
        sa.Column("booking_id", UUID(as_uuid=True), sa.ForeignKey("bookings.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_consultation_history_user", "consultation_history", ["user_id"],
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )

    # -- 7. prescriptions --
    op.create_table(
        "prescriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("guest_sessions.id")),
        sa.Column("consultation_id", UUID(as_uuid=True), sa.ForeignKey("consultation_history.id"), nullable=False),
        sa.Column("doctor_id", UUID(as_uuid=True), sa.ForeignKey("doctors.id"), nullable=False),
        sa.Column("prescription_date", sa.Date(), nullable=False),
        sa.Column("structured_data", JSONB),
        sa.Column("medicines", JSONB),
        sa.Column("treatments_prescribed", JSONB),
        sa.Column("diet_instructions_en", sa.Text()),
        sa.Column("follow_up_date", sa.Date()),
        sa.Column("raw_transcript_original", sa.Text()),
        sa.Column("raw_transcript_en", sa.Text()),
        sa.Column("pdf_url", sa.String(512)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_prescriptions_consultation", "prescriptions", ["consultation_id"])
    op.create_index(
        "ix_prescriptions_user", "prescriptions", ["user_id"],
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )

    # -- 8. product_purchase_history --
    op.create_table(
        "product_purchase_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("guest_sessions.id")),
        sa.Column("prescription_id", UUID(as_uuid=True), sa.ForeignKey("prescriptions.id")),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("product_slug", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=False),
        sa.Column("payment_ref", sa.String(255), nullable=False),
        sa.Column("stripe_session_id", sa.String(255)),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("shipping_address", JSONB),
        sa.Column("ordered_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending','paid','shipped','delivered','cancelled')",
            name="ck_product_purchase_status",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_product_purchase_quantity_positive"),
    )
    op.create_index(
        "ix_product_purchase_user", "product_purchase_history", ["user_id"],
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )

    # -- 9. Add session_id + guest_email to existing bookings table --
    op.add_column("bookings", sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("guest_sessions.id")))
    op.add_column("bookings", sa.Column("guest_email", sa.String(320)))


def downgrade() -> None:
    # Remove columns from bookings
    op.drop_column("bookings", "guest_email")
    op.drop_column("bookings", "session_id")

    # Drop tables in reverse dependency order
    op.drop_table("product_purchase_history")
    op.drop_table("prescriptions")
    op.drop_table("consultation_history")
    op.drop_table("booking_history")
    op.drop_table("user_watchlist")
    op.drop_table("user_preferences")
    op.drop_table("guest_sessions")
    op.drop_table("users")

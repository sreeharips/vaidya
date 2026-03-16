"""initial schema

Revision ID: fa4b757f8df1
Revises:
Create Date: 2026-03-16 10:04:48.592027

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "fa4b757f8df1"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- patient_profiles ---
    op.create_table(
        "patient_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pseudo_id", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("prakriti_raw", postgresql.JSONB),
        sa.Column("prakriti_scores", postgresql.JSONB),
        sa.Column("dosha_type", sa.String(32)),
        sa.Column("language", sa.String(5), server_default="en"),
        sa.Column("assessment_status", sa.String(20), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- clinic_feature_store ---
    op.create_table(
        "clinic_feature_store",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("tier", sa.Integer, server_default="1"),
        sa.Column("district", sa.String(255)),
        sa.Column("lat", sa.Float),
        sa.Column("lng", sa.Float),
        sa.Column("specialisations", postgresql.ARRAY(sa.String)),
        sa.Column("prakriti_affinities", postgresql.ARRAY(sa.String)),
        sa.Column("languages", postgresql.ARRAY(sa.String)),
        sa.Column("pricing_min", sa.Numeric(10, 2)),
        sa.Column("pricing_max", sa.Numeric(10, 2)),
        sa.Column("photos", postgresql.ARRAY(sa.String)),
        sa.Column("certifications", postgresql.ARRAY(sa.String)),
        sa.Column("outcome_enrolled", sa.Boolean, server_default="false"),
        sa.Column("accommodation_available", sa.Boolean, server_default="false"),
        sa.Column("transport_info", sa.Text),
        sa.Column("address", sa.String(512)),
        sa.Column("rating", sa.Float),
        sa.Column("review_count", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("search_vector", postgresql.TSVECTOR),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("tier IN (1, 2)", name="ck_clinic_tier"),
    )
    op.create_index("ix_clinic_search_vector", "clinic_feature_store", ["search_vector"], postgresql_using="gin")

    # --- doctors ---
    op.create_table(
        "doctors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("qualification", sa.String(255), nullable=False),
        sa.Column("years_exp", sa.Integer, server_default="0"),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), index=True),
        sa.Column("specialisations", postgresql.ARRAY(sa.String)),
        sa.Column("prakriti_affinities", postgresql.ARRAY(sa.String)),
        sa.Column("languages", postgresql.ARRAY(sa.String)),
        sa.Column("bio", sa.Text),
        sa.Column("photo_url", sa.String(512)),
        sa.Column("tier", sa.Integer, server_default="1"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("patients_treated", sa.Integer, server_default="0"),
        sa.Column("available_dates", postgresql.ARRAY(sa.Date)),
        sa.Column("location_address", sa.String(512)),
        sa.Column("rating", sa.Float),
        sa.Column("review_count", sa.Integer, server_default="0"),
        sa.Column("pricing_per_day", sa.Numeric(10, 2)),
        sa.Column("search_vector", postgresql.TSVECTOR),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("tier IN (1, 2)", name="ck_doctors_tier"),
    )
    op.create_index("ix_doctors_search_vector", "doctors", ["search_vector"], postgresql_using="gin")

    # --- treatments ---
    op.create_table(
        "treatments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("description", sa.Text),
        sa.Column("prakriti_tags", postgresql.ARRAY(sa.String)),
        sa.Column("duration_min_days", sa.Integer),
        sa.Column("duration_max_days", sa.Integer),
        sa.Column("price_per_day", sa.Numeric(10, 2)),
        sa.Column("included_therapies", postgresql.ARRAY(sa.String)),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), index=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id"), index=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- conditions_map ---
    op.create_table(
        "conditions_map",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("condition_slug", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("condition_name", sa.String(255), nullable=False),
        sa.Column("condition_name_ar", sa.String(255)),
        sa.Column("condition_name_ml", sa.String(255)),
        sa.Column("treatment_slugs", postgresql.ARRAY(sa.String)),
    )

    # --- treatment_kb ---
    op.create_table(
        "treatment_kb",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("prakriti_tags", postgresql.ARRAY(sa.String)),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id"), index=True),
        sa.Column("language", sa.String(5), server_default="en"),
        sa.Column("source_type", sa.String(50)),
        sa.Column("verified_by_doctor", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- bookings ---
    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_pseudo_id", sa.String(64), sa.ForeignKey("patient_profiles.pseudo_id"), nullable=False, index=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), nullable=False, index=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id"), nullable=False, index=True),
        sa.Column("treatment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("treatments.id"), nullable=False, index=True),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(30), server_default="pending"),
        sa.Column("payment_ref", sa.String(255)),
        sa.Column("commission_amount", sa.Numeric(10, 2)),
        sa.Column("stripe_session_id", sa.String(255)),
        sa.Column("cancellation_policy", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- voice_sessions ---
    op.create_table(
        "voice_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_pseudo_id", sa.String(64), index=True),
        sa.Column("language", sa.String(5), server_default="en"),
        sa.Column("stt_provider", sa.String(50)),
        sa.Column("intent_matches", postgresql.JSONB),
        sa.Column("confidence_scores", postgresql.JSONB),
        sa.Column("reask_count", sa.Integer, server_default="0"),
        sa.Column("final_answers", postgresql.JSONB),
        sa.Column("tier", sa.String(20), server_default="standard"),
        sa.Column("amount_paid", sa.Numeric(10, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- reviews ---
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_pseudo_id", sa.String(64), nullable=False, index=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), nullable=False, index=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id"), nullable=False, index=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), unique=True, nullable=False, index=True),
        sa.Column("rating", sa.Integer, nullable=False),
        sa.Column("review_text", sa.Text),
        sa.Column("treatment_slug", sa.String(255)),
        sa.Column("reviewer_location", sa.String(255)),
        sa.Column("verified", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating"),
    )

    # --- search_events ---
    op.create_table(
        "search_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("query", sa.String(500)),
        sa.Column("search_type", sa.String(30)),
        sa.Column("results_count", sa.Integer, server_default="0"),
        sa.Column("clicked_id", sa.String(255)),
        sa.Column("clicked_type", sa.String(30)),
        sa.Column("patient_pseudo_id", sa.String(64)),
        sa.Column("lang", sa.String(5), server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- outcomes_log ---
    # APPEND-ONLY — never UPDATE or DELETE any row. This is the AI training corpus.
    op.create_table(
        "outcomes_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(50), nullable=False, index=True),
        sa.Column("patient_pseudo_id", sa.String(64), index=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True)),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True)),
        sa.Column("answers_raw", postgresql.JSONB),
        sa.Column("scores", postgresql.JSONB),
        sa.Column("booking_status", sa.String(30)),
        sa.Column("medicine_ordered", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("event_type IS NOT NULL", name="ck_outcomes_log_append_only_marker"),
    )

    # --- tsvector triggers ---
    # Doctors: auto-update search_vector from name, bio, specialisations
    op.execute("""
        CREATE OR REPLACE FUNCTION doctors_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B') ||
                setweight(to_tsvector('english', COALESCE(array_to_string(NEW.specialisations, ' '), '')), 'A');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_doctors_search_vector
        BEFORE INSERT OR UPDATE ON doctors
        FOR EACH ROW EXECUTE FUNCTION doctors_search_vector_update();
    """)

    # Clinics: auto-update search_vector from name, district, specialisations
    op.execute("""
        CREATE OR REPLACE FUNCTION clinic_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(NEW.district, '')), 'B') ||
                setweight(to_tsvector('english', COALESCE(array_to_string(NEW.specialisations, ' '), '')), 'A');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_clinic_search_vector
        BEFORE INSERT OR UPDATE ON clinic_feature_store
        FOR EACH ROW EXECUTE FUNCTION clinic_search_vector_update();
    """)

    # --- outcomes_log: enforce append-only via trigger ---
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_outcomes_log_mutation() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'outcomes_log is APPEND-ONLY. UPDATE and DELETE are prohibited.';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_outcomes_log_no_update
        BEFORE UPDATE OR DELETE ON outcomes_log
        FOR EACH ROW EXECUTE FUNCTION prevent_outcomes_log_mutation();
    """)


def downgrade() -> None:
    # Drop triggers first
    op.execute("DROP TRIGGER IF EXISTS trg_outcomes_log_no_update ON outcomes_log;")
    op.execute("DROP FUNCTION IF EXISTS prevent_outcomes_log_mutation();")
    op.execute("DROP TRIGGER IF EXISTS trg_clinic_search_vector ON clinic_feature_store;")
    op.execute("DROP FUNCTION IF EXISTS clinic_search_vector_update();")
    op.execute("DROP TRIGGER IF EXISTS trg_doctors_search_vector ON doctors;")
    op.execute("DROP FUNCTION IF EXISTS doctors_search_vector_update();")

    # Drop tables in reverse dependency order
    op.drop_table("outcomes_log")
    op.drop_table("search_events")
    op.drop_table("reviews")
    op.drop_table("voice_sessions")
    op.drop_table("bookings")
    op.drop_table("treatment_kb")
    op.drop_table("conditions_map")
    op.drop_table("treatments")
    op.drop_table("doctors")
    op.drop_table("clinic_feature_store")
    op.drop_table("patient_profiles")

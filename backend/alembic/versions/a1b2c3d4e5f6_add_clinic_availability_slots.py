"""add clinic_availability_slots table

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-03-18 00:00:00.000000

Replaces the simple blocked-dates toggle with a richer per-day slot model:
  - total_slots: how many patients can be seen that day
  - is_closed: blocks the day entirely
  - treatment_ids: which treatments are available (empty = all clinic treatments)
  - notes: internal staff notes
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = "a1b2c3d4e5f6"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clinic_availability_slots",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", sa.UUID(as_uuid=True), sa.ForeignKey("clinic_feature_store.id"), nullable=False),
        sa.Column("slot_date", sa.Date, nullable=False),
        sa.Column("total_slots", sa.Integer, nullable=False, server_default="5"),
        sa.Column("is_closed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("close_reason", sa.String(255), nullable=True),
        sa.Column("treatment_ids", ARRAY(sa.String), nullable=True, server_default="{}"),
        sa.Column("notes", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_clinic_availability_clinic_id", "clinic_availability_slots", ["clinic_id"])
    op.create_index("ix_clinic_availability_clinic_date", "clinic_availability_slots", ["clinic_id", "slot_date"])
    op.create_unique_constraint("uq_clinic_slot_date", "clinic_availability_slots", ["clinic_id", "slot_date"])


def downgrade() -> None:
    op.drop_table("clinic_availability_slots")

"""make booking doctor_id nullable for clinic-level bookings

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-03-22 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("bookings", "doctor_id", existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    # Set any NULL doctor_ids to a placeholder before making non-nullable
    op.alter_column("bookings", "doctor_id", existing_type=sa.UUID(), nullable=False)

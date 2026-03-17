"""add clinic_id to users

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-17 10:00:00.000000

Links clinic_admin users to their clinic so the portal can scope
bookings, revenue, and profile data to the right clinic.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "clinic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clinic_feature_store.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_users_clinic_id", "users", ["clinic_id"],
                    postgresql_where=sa.text("clinic_id IS NOT NULL"))


def downgrade() -> None:
    op.drop_index("ix_users_clinic_id", table_name="users")
    op.drop_column("users", "clinic_id")

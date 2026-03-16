"""add booking financials

Revision ID: b9c2d1e3f4a5
Revises: fa4b757f8df1
Create Date: 2026-03-16 12:00:00.000000

Adds total_amount, lang, and currency to bookings.
- total_amount: price_per_day × nights, locked at booking time (treatment price may change later)
- lang: patient's language at booking, used to determine domestic vs international commission
- currency: ISO-4217 code, default USD
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "b9c2d1e3f4a5"
down_revision: Union[str, Sequence[str], None] = "fa4b757f8df1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("total_amount", sa.Numeric(10, 2), nullable=True))
    op.add_column("bookings", sa.Column("currency", sa.String(3), server_default="USD", nullable=False))
    op.add_column("bookings", sa.Column("lang", sa.String(5), server_default="en", nullable=False))


def downgrade() -> None:
    op.drop_column("bookings", "lang")
    op.drop_column("bookings", "currency")
    op.drop_column("bookings", "total_amount")

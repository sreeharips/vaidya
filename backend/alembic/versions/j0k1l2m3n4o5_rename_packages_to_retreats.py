"""rename wellness_packages to retreats and package_availability to retreat_availability

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-03-27 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old FK from bookings -> wellness_packages
    op.drop_constraint("bookings_package_id_fkey", "bookings", type_="foreignkey")

    # Rename tables
    op.rename_table("wellness_packages", "retreats")
    op.rename_table("package_availability", "retreat_availability")

    # Rename package_id -> retreat_id in retreat_availability
    op.alter_column("retreat_availability", "package_id", new_column_name="retreat_id")

    # Update unique constraint name on retreat_availability
    op.execute("ALTER TABLE retreat_availability DROP CONSTRAINT IF EXISTS uq_package_availability_date")
    op.create_unique_constraint("uq_retreat_availability_date", "retreat_availability", ["retreat_id", "date"])

    # Update FK in retreat_availability to point to retreats
    op.create_foreign_key(
        "retreat_availability_retreat_id_fkey",
        "retreat_availability",
        "retreats",
        ["retreat_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Rename package_id -> retreat_id in bookings
    op.alter_column("bookings", "package_id", new_column_name="retreat_id")

    # Re-create FK from bookings -> retreats
    op.create_foreign_key(
        "bookings_retreat_id_fkey",
        "bookings",
        "retreats",
        ["retreat_id"],
        ["id"],
    )

    # Rename package_name -> retreat_name in booking_history
    op.alter_column("booking_history", "package_name", new_column_name="retreat_name")


def downgrade() -> None:
    # Reverse: retreat_name -> package_name
    op.alter_column("booking_history", "retreat_name", new_column_name="package_name")

    # Drop new FK and rename back
    op.drop_constraint("bookings_retreat_id_fkey", "bookings", type_="foreignkey")
    op.alter_column("bookings", "retreat_id", new_column_name="package_id")
    op.create_foreign_key(
        "bookings_package_id_fkey",
        "bookings",
        "wellness_packages",
        ["package_id"],
        ["id"],
    )

    op.drop_constraint("retreat_availability_retreat_id_fkey", "retreat_availability", type_="foreignkey")
    op.execute("ALTER TABLE retreat_availability DROP CONSTRAINT IF EXISTS uq_retreat_availability_date")
    op.create_unique_constraint("uq_package_availability_date", "retreat_availability", ["retreat_id", "date"])
    op.alter_column("retreat_availability", "retreat_id", new_column_name="package_id")

    op.rename_table("retreat_availability", "package_availability")
    op.rename_table("retreats", "wellness_packages")

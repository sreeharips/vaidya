"""Add retreat_id to reviews

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'r8s9t0u1v2w3'
down_revision = 'q7r8s9t0u1v2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'reviews',
        sa.Column('retreat_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_reviews_retreat_id',
        'reviews', 'retreats',
        ['retreat_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_reviews_retreat_id', 'reviews', ['retreat_id'])

    # Backfill: set retreat_id from the linked booking where possible
    op.execute("""
        UPDATE reviews r
        SET retreat_id = b.retreat_id
        FROM bookings b
        WHERE r.booking_id = b.id
          AND b.retreat_id IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_index('ix_reviews_retreat_id', table_name='reviews')
    op.drop_constraint('fk_reviews_retreat_id', 'reviews', type_='foreignkey')
    op.drop_column('reviews', 'retreat_id')

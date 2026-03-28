"""retreat detail fields

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-03-28

Adds enriched detail columns to the retreats table:
  highlights, treatments_included, ideal_for, prakriti_tags,
  photos, daily_schedule, cancellation_policy,
  language_of_instruction, min_age
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'l2m3n4o5p6q7'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('retreats', sa.Column('highlights', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('retreats', sa.Column('treatments_included', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('retreats', sa.Column('ideal_for', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('retreats', sa.Column('prakriti_tags', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('retreats', sa.Column('photos', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('retreats', sa.Column('daily_schedule', sa.Text(), nullable=True))
    op.add_column('retreats', sa.Column('cancellation_policy', sa.Text(), nullable=True))
    op.add_column('retreats', sa.Column('language_of_instruction', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('retreats', sa.Column('min_age', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('retreats', 'min_age')
    op.drop_column('retreats', 'language_of_instruction')
    op.drop_column('retreats', 'cancellation_policy')
    op.drop_column('retreats', 'daily_schedule')
    op.drop_column('retreats', 'photos')
    op.drop_column('retreats', 'prakriti_tags')
    op.drop_column('retreats', 'ideal_for')
    op.drop_column('retreats', 'treatments_included')
    op.drop_column('retreats', 'highlights')

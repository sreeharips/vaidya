"""clinic detail fields

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-03-28

Adds enriched detail columns to clinic_feature_store:
  established_year, highlights, accommodation_types, meal_options,
  nearest_airport, nearest_railway, patient_capacity
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'm3n4o5p6q7r8'
down_revision = 'l2m3n4o5p6q7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('clinic_feature_store', sa.Column('established_year', sa.Integer(), nullable=True))
    op.add_column('clinic_feature_store', sa.Column('highlights', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('clinic_feature_store', sa.Column('accommodation_types', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('clinic_feature_store', sa.Column('meal_options', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('clinic_feature_store', sa.Column('nearest_airport', sa.String(255), nullable=True))
    op.add_column('clinic_feature_store', sa.Column('nearest_railway', sa.String(255), nullable=True))
    op.add_column('clinic_feature_store', sa.Column('patient_capacity', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('clinic_feature_store', 'patient_capacity')
    op.drop_column('clinic_feature_store', 'nearest_railway')
    op.drop_column('clinic_feature_store', 'nearest_airport')
    op.drop_column('clinic_feature_store', 'meal_options')
    op.drop_column('clinic_feature_store', 'accommodation_types')
    op.drop_column('clinic_feature_store', 'highlights')
    op.drop_column('clinic_feature_store', 'established_year')

"""add clinic_blocked_dates table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'clinic_blocked_dates',
        sa.Column('id', UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('clinic_id', UUID(as_uuid=True), sa.ForeignKey('clinic_feature_store.id'), nullable=False),
        sa.Column('blocked_date', sa.Date(), nullable=False),
        sa.Column('reason', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('clinic_id', 'blocked_date', name='uq_clinic_blocked_date'),
    )
    op.create_index('ix_clinic_blocked_dates_clinic_date', 'clinic_blocked_dates', ['clinic_id', 'blocked_date'])


def downgrade() -> None:
    op.drop_index('ix_clinic_blocked_dates_clinic_date')
    op.drop_table('clinic_blocked_dates')

"""Add rooms table and room columns to bookings

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 's9t0u1v2w3x4'
down_revision = 'r8s9t0u1v2w3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── rooms table ────────────────────────────────────────────────────────
    op.create_table(
        'rooms',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('clinic_feature_store.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(30), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('price_per_night_inr', sa.Numeric(10, 2), nullable=False),
        sa.Column('amenities', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('photos', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('max_occupancy', sa.Integer, nullable=False, server_default='2'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('display_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.CheckConstraint(
            "category IN ('non_ac','ac_standard','deluxe','suite')",
            name='ck_room_category',
        ),
        sa.CheckConstraint('price_per_night_inr > 0', name='ck_room_price_nonzero'),
    )
    op.create_index('ix_rooms_clinic', 'rooms', ['clinic_id', 'is_active', 'display_order'])

    # ── bookings: add room_id + room_price_inr_snapshot ────────────────────
    op.add_column('bookings',
        sa.Column('room_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('rooms.id', ondelete='SET NULL'),
                  nullable=True, index=True))
    op.add_column('bookings',
        sa.Column('room_price_inr_snapshot', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('bookings', 'room_price_inr_snapshot')
    op.drop_column('bookings', 'room_id')
    op.drop_index('ix_rooms_clinic', table_name='rooms')
    op.drop_table('rooms')

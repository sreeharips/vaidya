"""experiences, clinic_experiences, booking_add_ons tables

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-04-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = 'q7r8s9t0u1v2'
down_revision = 'p6q7r8s9t0u1'
branch_labels = None
depends_on = None

EXPERIENCE_CATEGORIES = ('sightseeing', 'adventure', 'cultural', 'nature', 'wellness')


def upgrade():
    # ── 1. Platform-curated experiences ──────────────────────────────────────
    op.create_table(
        'experiences',
        sa.Column('id',                     sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name_en',                sa.String(255), nullable=False),
        sa.Column('name_ar',                sa.String(255)),
        sa.Column('name_ml',                sa.String(255)),
        sa.Column('description_en',         sa.Text),
        sa.Column('description_ar',         sa.Text),
        sa.Column('description_ml',         sa.Text),
        sa.Column('category',               sa.String(50), nullable=False),
        sa.Column('lat',                    sa.Float),
        sa.Column('lng',                    sa.Float),
        sa.Column('district',               sa.String(255)),
        sa.Column('region_label',           sa.String(255)),
        sa.Column('typical_duration_hours', sa.Float),
        sa.Column('price_inr',              sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('is_free',                sa.Boolean, nullable=False, server_default='true'),
        sa.Column('photos',                 ARRAY(sa.String), server_default='{}'),
        sa.Column('external_url',           sa.String(512)),
        sa.Column('is_active',              sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at',             sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',             sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.CheckConstraint(
            "category IN ('sightseeing','adventure','cultural','nature','wellness')",
            name='ck_experiences_category',
        ),
    )
    op.create_index('ix_experiences_category', 'experiences', ['category', 'is_active'])
    op.create_index('ix_experiences_district', 'experiences', ['district'],
                    postgresql_where=sa.text('district IS NOT NULL'))

    # ── 2. Clinic-owned paid add-ons ─────────────────────────────────────────
    op.create_table(
        'clinic_experiences',
        sa.Column('id',                     sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('clinic_id',              sa.UUID(as_uuid=True), sa.ForeignKey('clinic_feature_store.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name_en',                sa.String(255), nullable=False),
        sa.Column('name_ar',                sa.String(255)),
        sa.Column('name_ml',                sa.String(255)),
        sa.Column('description_en',         sa.Text),
        sa.Column('description_ar',         sa.Text),
        sa.Column('description_ml',         sa.Text),
        sa.Column('category',               sa.String(50), nullable=False),
        sa.Column('price_inr',              sa.Numeric(10, 2), nullable=False),
        sa.Column('photos',                 ARRAY(sa.String), server_default='{}'),
        sa.Column('max_per_booking',        sa.Integer, nullable=False, server_default='1'),
        sa.Column('is_active',              sa.Boolean, nullable=False, server_default='true'),
        sa.Column('display_order',          sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at',             sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',             sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.CheckConstraint(
            "category IN ('sightseeing','adventure','cultural','nature','wellness')",
            name='ck_clinic_exp_category',
        ),
        sa.CheckConstraint('price_inr > 0', name='ck_clinic_exp_price_nonzero'),
    )
    op.create_index('ix_clinic_experiences_clinic', 'clinic_experiences',
                    ['clinic_id', 'is_active', 'display_order'])

    # ── 3. Booking add-on line items (append-only) ───────────────────────────
    op.create_table(
        'booking_add_ons',
        sa.Column('id',                   sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('booking_id',           sa.UUID(as_uuid=True), sa.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('add_on_type',          sa.String(10), nullable=False),   # 'platform' | 'clinic'
        sa.Column('experience_id',        sa.UUID(as_uuid=True), nullable=False),  # polymorphic — no FK
        sa.Column('name_snapshot',        sa.String(255), nullable=False),
        sa.Column('price_inr_snapshot',   sa.Numeric(10, 2), nullable=False),
        sa.Column('quantity',             sa.Integer, nullable=False, server_default='1'),
        sa.Column('created_at',           sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.CheckConstraint("add_on_type IN ('platform','clinic')", name='ck_booking_add_on_type'),
        sa.CheckConstraint('quantity >= 1', name='ck_booking_add_on_qty'),
    )
    op.create_index('ix_booking_add_ons_booking', 'booking_add_ons', ['booking_id'])


def downgrade():
    op.drop_index('ix_booking_add_ons_booking', table_name='booking_add_ons')
    op.drop_table('booking_add_ons')

    op.drop_index('ix_clinic_experiences_clinic', table_name='clinic_experiences')
    op.drop_table('clinic_experiences')

    op.drop_index('ix_experiences_district', table_name='experiences')
    op.drop_index('ix_experiences_category', table_name='experiences')
    op.drop_table('experiences')

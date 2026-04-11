"""platform_tags table

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'p6q7r8s9t0u1'
down_revision = 'o5p6q7r8s9t0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'platform_tags',
        sa.Column('id',         sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('type',       sa.String(50),  nullable=False),   # 'specialisation' | 'certification'
        sa.Column('value',      sa.String(255), nullable=False),
        sa.Column('is_active',  sa.Boolean,     nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer,     nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('type', 'value', name='uq_platform_tag_type_value'),
        sa.CheckConstraint("type IN ('specialisation','certification')", name='ck_platform_tag_type'),
    )
    op.create_index('ix_platform_tags_type', 'platform_tags', ['type', 'is_active'])

    # Seed specialisations
    op.execute("""
        INSERT INTO platform_tags (type, value, sort_order) VALUES
        ('specialisation', 'Panchakarma',     1),
        ('specialisation', 'Shirodhara',      2),
        ('specialisation', 'Abhyanga',        3),
        ('specialisation', 'Pizhichil',       4),
        ('specialisation', 'Njavara Kizhi',   5),
        ('specialisation', 'Nasya',           6),
        ('specialisation', 'Virechana',       7),
        ('specialisation', 'Basti',           8),
        ('specialisation', 'Udvartana',       9),
        ('specialisation', 'Rasayana',       10),
        ('specialisation', 'Kati Basti',     11),
        ('specialisation', 'Janu Basti',     12),
        ('specialisation', 'Takradhara',     13),
        ('specialisation', 'Lepa',           14),
        ('specialisation', 'Yoga Therapy',   15),
        ('specialisation', 'Diet Counselling', 16)
    """)

    # Seed certifications
    op.execute("""
        INSERT INTO platform_tags (type, value, sort_order) VALUES
        ('certification', 'NABH Accredited',                          1),
        ('certification', 'Govt of Kerala AYUSH Certified',           2),
        ('certification', 'ISO 9001:2015',                            3),
        ('certification', 'Kerala Ayurvedic Medicine Board',          4),
        ('certification', 'AYUSH Ministry Certified',                 5),
        ('certification', 'International Ayurvedic Medical Association', 6)
    """)


def downgrade():
    op.drop_index('ix_platform_tags_type', table_name='platform_tags')
    op.drop_table('platform_tags')

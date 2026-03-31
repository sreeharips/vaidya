"""waitlist_emails table

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-03-31

NOTE: Drop this migration and the waitlist_emails table after product launch.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'n4o5p6q7r8s9'
down_revision = 'm3n4o5p6q7r8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'waitlist_emails',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('source', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_waitlist_emails_email', 'waitlist_emails', ['email'])


def downgrade() -> None:
    op.drop_index('ix_waitlist_emails_email', table_name='waitlist_emails')
    op.drop_table('waitlist_emails')

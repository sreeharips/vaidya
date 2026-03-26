"""remove prakriti assessment — drop prakriti columns from user_preferences and patient_profiles

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-03-26 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- user_preferences: drop prakriti columns --
    op.drop_constraint(
        "user_preferences_prakriti_assessment_id_fkey",
        "user_preferences",
        type_="foreignkey",
    )
    op.drop_column("user_preferences", "prakriti_assessment_id")
    op.drop_column("user_preferences", "prakriti_completed_at")
    op.drop_column("user_preferences", "prakriti_secondary_type")
    op.drop_column("user_preferences", "prakriti_primary_type")
    op.drop_column("user_preferences", "prakriti_kapha_pct")
    op.drop_column("user_preferences", "prakriti_pitta_pct")
    op.drop_column("user_preferences", "prakriti_vata_pct")

    # -- patient_profiles: drop prakriti columns --
    op.drop_column("patient_profiles", "assessment_status")
    op.drop_column("patient_profiles", "dosha_type")
    op.drop_column("patient_profiles", "prakriti_scores")
    op.drop_column("patient_profiles", "prakriti_raw")


def downgrade() -> None:
    pass

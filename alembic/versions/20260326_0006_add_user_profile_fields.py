"""add user profile fields

Revision ID: 20260326_0006
Revises: 20260326_0005
Create Date: 2026-03-26 18:45:00
"""

from alembic import op

revision = "20260326_0006"
down_revision = "20260326_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS app_core")
    op.execute("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150)")
    op.execute("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)")


def downgrade() -> None:
    op.execute("ALTER TABLE app_core.users DROP COLUMN IF EXISTS phone")
    op.execute("ALTER TABLE app_core.users DROP COLUMN IF EXISTS full_name")

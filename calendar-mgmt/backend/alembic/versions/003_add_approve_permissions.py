"""add_approve_permissions

Revision ID: 003
Revises: 002
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("calendar_permissions", sa.Column("can_approve_leave", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("calendar_permissions", sa.Column("can_approve_overtime", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("calendar_permissions", sa.Column("can_approve_meetings", sa.Boolean(), server_default=sa.text("false"), nullable=False))


def downgrade() -> None:
    op.drop_column("calendar_permissions", "can_approve_leave")
    op.drop_column("calendar_permissions", "can_approve_overtime")
    op.drop_column("calendar_permissions", "can_approve_meetings")

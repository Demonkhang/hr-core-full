"""Create calendar_permissions table

Revision ID: 002
Revises: 001
Create Date: 2026-06-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'calendar_permissions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('position_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('position_name', sa.String(100), nullable=False),
        sa.Column('position_code', sa.String(20), nullable=False),
        sa.Column('can_read_schedule', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('can_create_schedule', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('can_update_schedule', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('can_delete_schedule', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('can_approve_schedule', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('can_manage_leave', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('can_manage_overtime', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('can_manage_meetings', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint('uq_calendar_permissions_position_id', 'calendar_permissions', ['position_id'])


def downgrade() -> None:
    op.drop_constraint('uq_calendar_permissions_position_id', 'calendar_permissions', type_='unique')
    op.drop_table('calendar_permissions')

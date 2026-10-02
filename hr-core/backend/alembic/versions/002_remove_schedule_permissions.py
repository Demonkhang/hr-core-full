"""Remove schedule permissions from positions

Revision ID: 002
Revises: 001
Create Date: 2026-06-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('positions', 'can_read_schedule')
    op.drop_column('positions', 'can_create_schedule')
    op.drop_column('positions', 'can_update_schedule')
    op.drop_column('positions', 'can_delete_schedule')
    op.drop_column('positions', 'can_approve_schedule')


def downgrade() -> None:
    op.add_column('positions', sa.Column('can_approve_schedule', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('positions', sa.Column('can_delete_schedule', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('positions', sa.Column('can_update_schedule', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('positions', sa.Column('can_create_schedule', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('positions', sa.Column('can_read_schedule', sa.Boolean(), server_default='true', nullable=False))

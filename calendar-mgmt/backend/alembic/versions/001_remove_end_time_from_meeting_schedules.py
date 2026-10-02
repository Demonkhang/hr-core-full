"""remove end_time from meeting_schedules

Revision ID: 001
Revises: 
Create Date: 2026-06-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('meeting_schedules', 'end_time')


def downgrade() -> None:
    op.add_column('meeting_schedules', sa.Column('end_time', sa.Time(), nullable=False))

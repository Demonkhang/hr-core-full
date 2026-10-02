"""Add can_manage_departments and can_manage_workplaces to positions

Revision ID: 001
Revises: 
Create Date: 2026-06-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('positions', sa.Column('can_manage_departments', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('positions', sa.Column('can_manage_workplaces', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('positions', 'can_manage_workplaces')
    op.drop_column('positions', 'can_manage_departments')

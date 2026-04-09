"""Add tickets table

Revision ID: 20260127_add_tickets
Revises: ac161e495586
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260127_add_tickets'
down_revision: Union[str, None] = 'ac161e495586'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types
    ticket_type = postgresql.ENUM('feature', 'bug', 'task', 'improvement', name='tickettype', create_type=False)
    ticket_type.create(op.get_bind(), checkfirst=True)
    
    ticket_status = postgresql.ENUM('open', 'in_progress', 'review', 'done', 'closed', name='ticketstatus', create_type=False)
    ticket_status.create(op.get_bind(), checkfirst=True)
    
    ticket_priority = postgresql.ENUM('low', 'medium', 'high', 'critical', name='ticketpriority', create_type=False)
    ticket_priority.create(op.get_bind(), checkfirst=True)
    
    op.create_table(
        'tickets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('business_value', sa.Text(), nullable=True),
        sa.Column('type', postgresql.ENUM('feature', 'bug', 'task', 'improvement', name='tickettype', create_type=False), nullable=False, server_default='feature'),
        sa.Column('status', postgresql.ENUM('open', 'in_progress', 'review', 'done', 'closed', name='ticketstatus', create_type=False), nullable=False, server_default='open'),
        sa.Column('priority', postgresql.ENUM('low', 'medium', 'high', 'critical', name='ticketpriority', create_type=False), nullable=False, server_default='medium'),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('creator_id', sa.UUID(), nullable=False),
        sa.Column('assignee_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tickets_project_id'), 'tickets', ['project_id'], unique=False)
    op.create_index(op.f('ix_tickets_creator_id'), 'tickets', ['creator_id'], unique=False)
    op.create_index(op.f('ix_tickets_status'), 'tickets', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_tickets_status'), table_name='tickets')
    op.drop_index(op.f('ix_tickets_creator_id'), table_name='tickets')
    op.drop_index(op.f('ix_tickets_project_id'), table_name='tickets')
    op.drop_table('tickets')
    
    # Drop enum types
    op.execute('DROP TYPE IF EXISTS tickettype')
    op.execute('DROP TYPE IF EXISTS ticketstatus')
    op.execute('DROP TYPE IF EXISTS ticketpriority')

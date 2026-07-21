"""Add demo access request approval workflow.

Revision ID: 004_demo_access_requests
Revises: 003_unpublish_request
Create Date: 2026-07-21
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "004_demo_access_requests"
down_revision: str | None = "003_unpublish_request"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "demo_access_requests" in inspector.get_table_names():
        return
    op.create_table(
        "demo_access_requests",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("organization", sa.String(255), nullable=True),
        sa.Column("intended_use", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_demo_access_requests_email", "demo_access_requests", ["email"])
    op.create_index("ix_demo_access_requests_status", "demo_access_requests", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    if "demo_access_requests" in sa.inspect(bind).get_table_names():
        op.drop_table("demo_access_requests")

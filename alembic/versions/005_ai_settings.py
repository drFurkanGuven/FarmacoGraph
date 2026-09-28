"""Add AI settings table.

Revision ID: 005_ai_settings
Revises: 004_demo_access_requests
Create Date: 2026-01-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "005_ai_settings"
down_revision = "004_demo_access_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "ai_settings" not in inspector.get_table_names():
        op.create_table(
            "ai_settings",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", UUID(as_uuid=True), nullable=True),
            sa.Column("organization_id", UUID(as_uuid=True), nullable=True),
            sa.Column("provider", sa.String(50), nullable=False),
            sa.Column("api_key_encrypted", sa.Text, nullable=False),
            sa.Column("model", sa.String(100), nullable=False),
            sa.Column("base_url", sa.String(255), nullable=True),
            sa.Column("is_active", sa.Boolean, default=True, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_ai_settings_user_id", "ai_settings", ["user_id"])
        op.create_index("ix_ai_settings_org_id", "ai_settings", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_settings_org_id", table_name="ai_settings")
    op.drop_index("ix_ai_settings_user_id", table_name="ai_settings")
    op.drop_table("ai_settings")

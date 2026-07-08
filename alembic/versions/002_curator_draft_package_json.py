"""Add curator_workflows.draft_package_json for Studio draft persistence.

Revision ID: 002_draft_package
Revises: 001_initial
Create Date: 2026-07-08

create_all() does not ALTER existing tables, so production DBs created before
commit 486e608 silently lack this column. SELECT/INSERT against CuratorWorkflow
then raises UndefinedColumn and surfaces as HTTP 500 on /dashboard and /curator/*.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_draft_package"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("curator_workflows")}
    if "draft_package_json" in columns:
        return

    dialect = bind.dialect.name
    col_type = postgresql.JSONB() if dialect == "postgresql" else sa.JSON()
    op.add_column(
        "curator_workflows",
        sa.Column("draft_package_json", col_type, nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("curator_workflows")}
    if "draft_package_json" not in columns:
        return
    op.drop_column("curator_workflows", "draft_package_json")

"""Add curator_workflows unpublish-request columns.

Revision ID: 003_unpublish_request
Revises: 002_draft_package
Create Date: 2026-07-11

Pending unpublish requests stay on the published workflow until an admin
approves (return-to-draft) or rejects/cancels the request.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_unpublish_request"
down_revision: Union[str, None] = "002_draft_package"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS: tuple[tuple[str, sa.types.TypeEngine], ...] = (
    ("unpublish_requested_at", sa.DateTime(timezone=True)),
    ("unpublish_requested_by", sa.Uuid()),
    ("unpublish_request_notes", sa.Text()),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("curator_workflows")}
    for name, col_type in _COLUMNS:
        if name in columns:
            continue
        op.add_column("curator_workflows", sa.Column(name, col_type, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("curator_workflows")}
    for name, _ in reversed(_COLUMNS):
        if name not in columns:
            continue
        op.drop_column("curator_workflows", name)

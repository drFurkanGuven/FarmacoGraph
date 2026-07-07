"""Initial operational schema — tenants, jobs, audit, snapshots, outbox."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables created via SQLAlchemy models — use autogenerate in production.
    # This revision documents the initial schema version.
    pass


def downgrade() -> None:
    pass

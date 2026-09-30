"""Add drug_drug_interactions as a first-class table for external DDI data.

The FDA DailyMed dataset (19,054 pairs) was previously loaded into
curator_workflows, which is the curator review queue rather than an
interaction store. That made every imported pair look like a pending curator
task, and no read path ever consulted it.

These rows are external reference data, not curator-authored content, so the
table keeps curation_status and source explicit and records which endpoints
could not be resolved to a Drug.

Revision ID: 006_drug_drug_interactions
Revises: 005_ai_settings
Create Date: 2026-09-30
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "006_drug_drug_interactions"
down_revision: str | None = "005_ai_settings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "drug_drug_interactions" in inspector.get_table_names():
        return
    op.create_table(
        "drug_drug_interactions",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("drug_a_id", sa.Uuid(), nullable=True),
        sa.Column("drug_b_id", sa.Uuid(), nullable=True),
        sa.Column("drug_a_slug", sa.String(255), nullable=False),
        sa.Column("drug_b_slug", sa.String(255), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("severity", sa.String(32), nullable=False),
        sa.Column("mechanism_explanation", sa.Text(), nullable=False),
        sa.Column("clinical_action", sa.Text(), nullable=False),
        sa.Column("curation_status", sa.String(32), nullable=False, server_default="external"),
        sa.Column("source", sa.String(64), nullable=False, server_default="fda-ddi"),
        sa.Column("source_doi", sa.String(255), nullable=True),
        sa.Column("import_batch", sa.String(64), nullable=True),
        sa.Column("evidence_ids", sa.JSON(), nullable=True),
        sa.Column("extra", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    # Pair lookups happen on (drug_a, drug_b) in both directions, and the pair
    # itself must stay unique within a batch.
    op.create_index(
        "ix_ddi_pair", "drug_drug_interactions", ["drug_a_slug", "drug_b_slug"]
    )
    op.create_index("ix_ddi_a", "drug_drug_interactions", ["drug_a_id"])
    op.create_index("ix_ddi_b", "drug_drug_interactions", ["drug_b_id"])
    op.create_index("ix_ddi_severity", "drug_drug_interactions", ["severity"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "drug_drug_interactions" not in inspector.get_table_names():
        return
    op.drop_table("drug_drug_interactions")

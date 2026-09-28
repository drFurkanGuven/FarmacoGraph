"""Initial operational schema — mirrors farmacograph.db.postgres.models.

Revision ID: 001_initial
Revises: None

Every table/column matches the SQLAlchemy models so a fresh
`alembic upgrade head` produces the same schema as `init_db(create_all)`.
Later revisions (002 draft_package_json, 003 unpublish columns,
004 demo_access_requests) stay idempotent no-ops on fresh installs.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _uuid() -> sa.types.TypeEngine:
    return sa.Uuid()


def _json() -> sa.types.TypeEngine:
    return postgresql.JSONB().with_variant(sa.JSON(), "sqlite")


def _created_updated() -> list:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    uuid_type = _uuid()
    json_type = _json()

    if "organizations" not in tables:
        op.create_table(
            "organizations",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(100), unique=True, nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
            *_created_updated(),
        )

    if "projects" not in tables:
        op.create_table(
            "projects",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column(
                "organization_id",
                uuid_type,
                sa.ForeignKey("organizations.id"),
                nullable=False,
            ),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(100), nullable=False),
            *_created_updated(),
            sa.UniqueConstraint("organization_id", "slug"),
        )

    if "workspaces" not in tables:
        op.create_table(
            "workspaces",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column(
                "project_id", uuid_type, sa.ForeignKey("projects.id"), nullable=False
            ),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(100), nullable=False),
            *_created_updated(),
            sa.UniqueConstraint("project_id", "slug"),
        )

    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column("email", sa.String(320), unique=True, nullable=False),
            sa.Column("hashed_password", sa.String(255), nullable=True),
            sa.Column("full_name", sa.String(255), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
            sa.Column("is_superuser", sa.Boolean(), nullable=False, default=False),
            *_created_updated(),
        )

    if "demo_access_requests" not in tables:
        op.create_table(
            "demo_access_requests",
            sa.Column("id", uuid_type, primary_key=True, nullable=False),
            sa.Column("email", sa.String(320), nullable=False),
            sa.Column("full_name", sa.String(255), nullable=False),
            sa.Column("organization", sa.String(255), nullable=True),
            sa.Column("intended_use", sa.Text(), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("reviewed_by", uuid_type, nullable=True),
            sa.Column("user_id", uuid_type, sa.ForeignKey("users.id"), nullable=True),
            *_created_updated(),
        )
        op.create_index(
            "ix_demo_access_requests_email", "demo_access_requests", ["email"]
        )
        op.create_index(
            "ix_demo_access_requests_status", "demo_access_requests", ["status"]
        )

    if "user_roles" not in tables:
        op.create_table(
            "user_roles",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column("user_id", uuid_type, sa.ForeignKey("users.id"), nullable=False),
            sa.Column(
                "organization_id",
                uuid_type,
                sa.ForeignKey("organizations.id"),
                nullable=True,
            ),
            sa.Column(
                "workspace_id", uuid_type, sa.ForeignKey("workspaces.id"), nullable=True
            ),
            sa.Column("role", sa.String(50), nullable=False),
            sa.Column("scopes", json_type, nullable=False),
            *_created_updated(),
        )

    if "api_keys" not in tables:
        op.create_table(
            "api_keys",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column("user_id", uuid_type, sa.ForeignKey("users.id"), nullable=True),
            sa.Column(
                "organization_id",
                uuid_type,
                sa.ForeignKey("organizations.id"),
                nullable=True,
            ),
            sa.Column(
                "workspace_id", uuid_type, sa.ForeignKey("workspaces.id"), nullable=True
            ),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("key_prefix", sa.String(16), nullable=False),
            sa.Column("key_hash", sa.String(128), nullable=False),
            sa.Column("scopes", json_type, nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
            *_created_updated(),
        )
        op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"])

    if "audit_logs" not in tables:
        op.create_table(
            "audit_logs",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column(
                "timestamp",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("actor_id", uuid_type, nullable=True),
            sa.Column("organization_id", uuid_type, nullable=True),
            sa.Column("workspace_id", uuid_type, nullable=True),
            sa.Column("action", sa.String(100), nullable=False),
            sa.Column("resource_type", sa.String(100), nullable=False),
            sa.Column("resource_id", sa.String(255), nullable=True),
            sa.Column("diff_json", json_type, nullable=True),
            sa.Column("ip_address", sa.String(45), nullable=True),
            sa.Column("correlation_id", sa.String(36), nullable=True),
        )
        op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])
        op.create_index("ix_audit_logs_correlation_id", "audit_logs", ["correlation_id"])

    if "jobs" not in tables:
        op.create_table(
            "jobs",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column("job_type", sa.String(100), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("priority", sa.Integer(), nullable=False, default=0),
            sa.Column("payload_json", json_type, nullable=False),
            sa.Column("result_json", json_type, nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("attempts", sa.Integer(), nullable=False, default=0),
            sa.Column("max_attempts", sa.Integer(), nullable=False, default=3),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("correlation_id", sa.String(36), nullable=True),
            sa.Column("workspace_id", uuid_type, nullable=True),
            sa.Column("created_by", uuid_type, nullable=True),
            *_created_updated(),
        )
        op.create_index("ix_jobs_job_type", "jobs", ["job_type"])
        op.create_index("ix_jobs_status", "jobs", ["status"])

    if "outbox_events" not in tables:
        op.create_table(
            "outbox_events",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column("event_type", sa.String(100), nullable=False),
            sa.Column("event_version", sa.String(20), nullable=False, default="1.0.0"),
            sa.Column("aggregate_type", sa.String(100), nullable=False),
            sa.Column("aggregate_id", sa.String(36), nullable=False),
            sa.Column("payload_json", json_type, nullable=False),
            sa.Column("status", sa.String(20), nullable=False, default="pending"),
            sa.Column(
                "occurred_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("correlation_id", sa.String(36), nullable=True),
            sa.Column("tenant_id", uuid_type, nullable=True),
            sa.Column("workspace_id", uuid_type, nullable=True),
            sa.Column("actor_id", uuid_type, nullable=True),
            sa.Column("attempts", sa.Integer(), nullable=False, default=0),
        )
        op.create_index("ix_outbox_events_event_type", "outbox_events", ["event_type"])
        op.create_index("ix_outbox_events_status", "outbox_events", ["status"])

    if "knowledge_snapshots" not in tables:
        op.create_table(
            "knowledge_snapshots",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column("version_tag", sa.String(50), unique=True, nullable=False),
            sa.Column("module", sa.String(100), nullable=True),
            sa.Column("ontology_version", sa.String(20), nullable=False),
            sa.Column("api_version", sa.String(10), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, default="staged"),
            sa.Column("immutable", sa.Boolean(), nullable=False, default=True),
            sa.Column("entity_count", sa.Integer(), nullable=False, default=0),
            sa.Column(
                "relationship_count", sa.Integer(), nullable=False, default=0
            ),
            sa.Column("evidence_count", sa.Integer(), nullable=False, default=0),
            sa.Column("manifest_json", json_type, nullable=False),
            sa.Column("validation_report_hash", sa.String(64), nullable=True),
            sa.Column("released_by", uuid_type, nullable=True),
            sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
            *_created_updated(),
        )

    if "curator_workflows" not in tables:
        op.create_table(
            "curator_workflows",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column("entity_id", sa.String(36), nullable=False),
            sa.Column("entity_type", sa.String(100), nullable=False),
            sa.Column("workspace_id", uuid_type, nullable=True),
            sa.Column("assigned_to", uuid_type, nullable=True),
            sa.Column("state", sa.String(20), nullable=False, default="draft"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("draft_package_json", json_type, nullable=True),
            sa.Column("unpublish_requested_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("unpublish_requested_by", uuid_type, nullable=True),
            sa.Column("unpublish_request_notes", sa.Text(), nullable=True),
            *_created_updated(),
        )
        op.create_index("ix_curator_workflows_entity_id", "curator_workflows", ["entity_id"])
        op.create_index("ix_curator_workflows_state", "curator_workflows", ["state"])

    if "feature_flags" not in tables:
        op.create_table(
            "feature_flags",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column(
                "organization_id",
                uuid_type,
                sa.ForeignKey("organizations.id"),
                nullable=True,
            ),
            sa.Column(
                "workspace_id", uuid_type, sa.ForeignKey("workspaces.id"), nullable=True
            ),
            sa.Column("flag_key", sa.String(100), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False, default=False),
            sa.Column("config_json", json_type, nullable=False),
            *_created_updated(),
        )

    if "api_usage" not in tables:
        op.create_table(
            "api_usage",
            sa.Column("id", uuid_type, primary_key=True),
            sa.Column("date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("api_key_id", uuid_type, nullable=True),
            sa.Column("organization_id", uuid_type, nullable=True),
            sa.Column("endpoint", sa.String(255), nullable=False),
            sa.Column("request_count", sa.Integer(), nullable=False, default=0),
        )
        op.create_index(
            "ix_api_usage_date_endpoint", "api_usage", ["date", "endpoint"]
        )


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    for table in [
        "api_usage",
        "feature_flags",
        "curator_workflows",
        "knowledge_snapshots",
        "outbox_events",
        "jobs",
        "audit_logs",
        "api_keys",
        "user_roles",
        "demo_access_requests",
        "users",
        "workspaces",
        "projects",
        "organizations",
    ]:
        if table in tables:
            op.drop_table(table)

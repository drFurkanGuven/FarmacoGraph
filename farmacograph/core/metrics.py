"""Prometheus metrics for platform observability."""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

API_REQUESTS = Counter(
    "fg_api_requests_total",
    "Total API requests",
    ["method", "endpoint", "status"],
)

API_LATENCY = Histogram(
    "fg_api_request_duration_seconds",
    "API request latency",
    ["method", "endpoint"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

VALIDATION_ERRORS = Counter(
    "fg_validation_errors_total",
    "Validation errors by constraint",
    ["constraint_id"],
)

JOB_COUNTER = Counter(
    "fg_jobs_total",
    "Background jobs by type and status",
    ["job_type", "status"],
)

SNAPSHOT_ENTITY_COUNT = Gauge(
    "fg_snapshot_entity_count",
    "Entities in latest published snapshot",
    ["dataset_version"],
)

NEO4J_HEALTH = Gauge(
    "fg_neo4j_health",
    "Neo4j connectivity (1=up, 0=down)",
)

POSTGRES_HEALTH = Gauge(
    "fg_postgresql_health",
    "PostgreSQL connectivity (1=up, 0=down)",
)

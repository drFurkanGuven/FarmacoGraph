"""FarmacoGraph API — the product. Controllers depend on services only."""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app

from farmacograph.api.middleware import CorrelationMiddleware
from farmacograph.api.routers import curator, drugs, explain, health, learning, platform
from farmacograph.core.config import get_settings
from farmacograph.core.container import get_container
from farmacograph.core.exceptions import FarmacoGraphError
from farmacograph.core.logging import configure_logging, get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    configure_logging(log_level=settings.log_level, json_logs=settings.log_json)
    container = get_container()
    await container.startup()
    logger.info("application_started", environment=settings.environment)
    yield
    await container.shutdown()
    logger.info("application_shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="FarmacoGraph API",
        version="1.0.0",
        description="Explainable biomedical knowledge platform. The API is the product.",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(CorrelationMiddleware)

    @app.exception_handler(FarmacoGraphError)
    async def farmacograph_error_handler(request: Request, exc: FarmacoGraphError) -> JSONResponse:
        status = 404 if exc.code in ("ENTITY_NOT_FOUND", "NO_PATH") else 400
        if exc.code == "SERVICE_UNAVAILABLE":
            status = 503
        if exc.code == "AUTHENTICATION_REQUIRED":
            status = 401
        if exc.code == "AUTHORIZATION_FAILED":
            status = 403
        return JSONResponse(
            status_code=status,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    api_v1 = FastAPI(title="FarmacoGraph API v1")
    api_v1.include_router(health.router)
    api_v1.include_router(curator.router)
    api_v1.include_router(drugs.router)
    api_v1.include_router(explain.explain_router)
    api_v1.include_router(explain.compare_router)
    api_v1.include_router(platform.search_router)
    api_v1.include_router(platform.modules_router)
    api_v1.include_router(platform.stats_router)
    api_v1.include_router(learning.router)

    app.mount("/api/v1", api_v1)

    if settings.metrics_enabled:
        app.mount("/metrics", make_asgi_app())

    return app


app = create_app()

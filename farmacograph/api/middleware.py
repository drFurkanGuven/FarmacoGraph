"""API middleware — logging, metrics, correlation IDs."""

from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from farmacograph.core.logging import get_logger
from farmacograph.core.metrics import API_LATENCY, API_REQUESTS

logger = get_logger(__name__)


class CorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        correlation_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        request.state.correlation_id = correlation_id
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - start
        endpoint = request.url.path
        API_REQUESTS.labels(
            method=request.method,
            endpoint=endpoint,
            status=str(response.status_code),
        ).inc()
        API_LATENCY.labels(method=request.method, endpoint=endpoint).observe(elapsed)
        response.headers["X-Request-Id"] = correlation_id
        response.headers["X-API-Version"] = "v1"
        logger.info(
            "api_request",
            method=request.method,
            path=endpoint,
            status=response.status_code,
            duration_ms=int(elapsed * 1000),
            correlation_id=correlation_id,
        )
        return response

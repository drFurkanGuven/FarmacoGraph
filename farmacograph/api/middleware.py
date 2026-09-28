"""API middleware — logging, metrics, correlation IDs, and rate limiting."""

from __future__ import annotations

import collections
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from farmacograph.core.logging import get_logger
from farmacograph.core.metrics import API_LATENCY, API_REQUESTS

logger = get_logger(__name__)

# Rate limit tiers (requests per minute)
TIER_ENTERPRISE = 5000
TIER_DEVELOPER = 1000
TIER_STUDENT = 300
TIER_ANONYMOUS = 60

EXEMPT_PATHS = frozenset(
    {
        "/api/v1/health",
        "/api/v1/info",
        "/api/v1/docs",
        "/api/v1/redoc",
        "/api/v1/openapi.json",
        "/health",
        "/info",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico",
    }
)


class RateLimiter:
    """Sliding-window in-memory rate limiter with tier resolution."""

    def __init__(self) -> None:
        # client_id -> deque of request timestamps (epoch seconds)
        self._windows: dict[str, collections.deque[float]] = {}
        self._last_cleanup: float = time.monotonic()

    def _cleanup_old_entries(self, now: float) -> None:
        """Prune idle clients periodically to avoid memory growth."""
        if now - self._last_cleanup < 300:  # Every 5 minutes
            return
        self._last_cleanup = now
        dead_keys = [k for k, q in self._windows.items() if not q or q[-1] < now - 120]
        for k in dead_keys:
            self._windows.pop(k, None)

    def clear(self) -> None:
        """Drop all sliding-window state (used by tests to isolate rate-limit cases)."""
        self._windows.clear()
        self._last_cleanup = time.monotonic()

    def check(self, client_id: str, limit: int) -> tuple[bool, int, int]:
        """Returns (is_allowed, remaining, reset_seconds)."""
        now = time.monotonic()
        self._cleanup_old_entries(now)
        window = self._windows.setdefault(client_id, collections.deque())

        # Evict timestamps older than 60 seconds
        cutoff = now - 60.0
        while window and window[0] < cutoff:
            window.popleft()

        current_count = len(window)
        if current_count >= limit:
            oldest = window[0] if window else now
            reset_seconds = max(1, int(60.0 - (now - oldest)))
            return False, 0, reset_seconds

        window.append(now)
        remaining = max(0, limit - len(window))
        reset_seconds = 60
        return True, remaining, reset_seconds


_global_rate_limiter = RateLimiter()


def resolve_client_quota(
    auth_context,
    *,
    api_key_header: str = "",
    auth_header: str = "",
    client_host: str = "unknown",
) -> tuple[str, int]:
    """Map a request to its (rate-limit bucket, requests/minute) tier.

    The quota class comes from VERIFIED identity only:
    - verified API key  -> developer tier (enterprise iff the verified key
      itself carries the ``fg_ent_`` family prefix);
    - verified JWT      -> student tier;
    - anything else (anonymous, expired, forged or unknown key) ->
      anonymous tier keyed by client IP.

    A forged ``fg_ent_`` header that fails validation therefore lands in the
    anonymous bucket instead of the enterprise bucket.
    """
    presented = (api_key_header or "").strip()
    bearer_token = ""
    if auth_header.startswith("Bearer "):
        bearer_token = auth_header[7:].strip()
    claimed_key = presented or bearer_token

    if auth_context is not None and getattr(auth_context, "is_authenticated", False):
        if getattr(auth_context, "auth_method", "") == "api_key" and claimed_key:
            if claimed_key.startswith("fg_ent_"):
                return f"apikey:{claimed_key[:16]}", TIER_ENTERPRISE
            return f"apikey:{claimed_key[:16] or 'unknown'}", TIER_DEVELOPER
        user_id = getattr(auth_context, "user_id", None)
        if user_id is not None:
            return f"jwt:{user_id}", TIER_STUDENT
        return f"jwt:{(auth_header or '')[-16:] or 'unknown'}", TIER_STUDENT

    return f"ip:{client_host}", TIER_ANONYMOUS


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enforces tier-based sliding-window rate limits across API consumers.

    Quota class is derived from the VERIFIED auth context attached by
    AuthContextMiddleware (which runs first). A self-asserted key prefix such
    as ``fg_ent_`` grants nothing on its own: unverified callers always fall
    into the anonymous bucket. Quota is not authorization — endpoint scopes
    are still enforced independently in deps.
    """

    def __init__(self, app, enabled: bool = True) -> None:
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self.enabled or request.method == "OPTIONS" or request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        # Resolve tier and client identity
        auth_header = request.headers.get("Authorization", "")
        api_key_header = request.headers.get("X-API-Key", "")
        auth_context = getattr(request.state, "auth_context", None)
        forwarded = request.headers.get("X-Forwarded-For")
        ip = (
            forwarded.split(",")[0].strip()
            if forwarded
            else (request.client.host if request.client else "unknown")
        )
        client_key, limit = resolve_client_quota(
            auth_context,
            api_key_header=api_key_header,
            auth_header=auth_header,
            client_host=ip,
        )

        allowed, remaining, reset_seconds = _global_rate_limiter.check(client_key, limit)

        if not allowed:
            logger.warning("rate_limit_exceeded", client=client_key, limit=limit)
            return JSONResponse(
                status_code=429,
                content={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded. Tier allows {limit} requests/min.",
                    "retry_after_seconds": reset_seconds,
                },
                headers={
                    "Retry-After": str(reset_seconds),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_seconds),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_seconds)
        return response


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

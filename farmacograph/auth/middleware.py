"""Auth middleware — attaches resolved AuthContext to request.state."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from farmacograph.auth.models import AuthContext
from farmacograph.auth.service import AuthService
from farmacograph.core.config import get_settings
from farmacograph.core.container import get_container


async def resolve_request_auth(
    request: Request,
    *,
    authorization: str | None = None,
    api_key_header: str | None = None,
) -> AuthContext:
    settings = get_settings()
    container = get_container()
    auth_service = AuthService(container.session_factory, settings)

    auth_header = authorization
    if auth_header is None:
        auth_header = request.headers.get("Authorization")
    if api_key_header is None:
        api_key_header = request.headers.get("X-API-Key")

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            resolved = await auth_service.resolve_bearer(token)
            if resolved is not None:
                return resolved

    if api_key_header:
        resolved = await auth_service.resolve_api_key_header(api_key_header.strip())
        if resolved is not None:
            return resolved

    return AuthContext()


class AuthContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request.state.auth_context = await resolve_request_auth(request)
        return await call_next(request)

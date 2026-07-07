"""Application-wide exceptions."""

from __future__ import annotations


class FarmacoGraphError(Exception):
    """Base platform exception."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class NotFoundError(FarmacoGraphError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, code="ENTITY_NOT_FOUND")


class ValidationError(FarmacoGraphError):
    def __init__(self, message: str = "Validation failed") -> None:
        super().__init__(message, code="VALIDATION_ERROR")


class AuthenticationError(FarmacoGraphError):
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(message, code="AUTHENTICATION_REQUIRED")


class AuthorizationError(FarmacoGraphError):
    def __init__(self, message: str = "Insufficient permissions") -> None:
        super().__init__(message, code="AUTHORIZATION_FAILED")


class NoPathError(FarmacoGraphError):
    def __init__(self, message: str = "No validated path in knowledge base") -> None:
        super().__init__(message, code="NO_PATH")


class ServiceUnavailableError(FarmacoGraphError):
    def __init__(self, message: str = "Service unavailable") -> None:
        super().__init__(message, code="SERVICE_UNAVAILABLE")

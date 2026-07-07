"""SQLAlchemy declarative base."""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base for all PostgreSQL operational models. No biomedical entities here."""

"""Domain event bus with handler registration."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any
from uuid import uuid4

from farmacograph.core.logging import get_logger

logger = get_logger(__name__)

EventHandler = Callable[[dict[str, Any]], Awaitable[None]]


class EventBus:
    """In-process event bus. Production uses outbox for durability."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = {}

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    async def publish(self, event: dict[str, Any]) -> None:
        event_type = event.get("event_type", "")
        if "event_id" not in event:
            event["event_id"] = str(uuid4())
        logger.info("event_published", event_type=event_type, event_id=event["event_id"])
        for handler in self._handlers.get(event_type, []):
            try:
                await handler(event)
            except Exception as exc:
                logger.error("event_handler_failed", event_type=event_type, error=str(exc))

    def build_event(
        self,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        payload: dict[str, Any],
        **kwargs: Any,
    ) -> dict[str, Any]:
        return {
            "event_type": event_type,
            "event_version": "1.0.0",
            "aggregate_type": aggregate_type,
            "aggregate_id": aggregate_id,
            "payload": payload,
            **kwargs,
        }

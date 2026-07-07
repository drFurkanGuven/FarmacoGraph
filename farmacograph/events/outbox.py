"""Outbox publisher — bridges transactional outbox to event bus."""

from __future__ import annotations

from farmacograph.events.bus import EventBus
from farmacograph.repositories.outbox import OutboxRepository


class OutboxPublisher:
    """Poll pending outbox events and publish to in-process bus."""

    def __init__(self, outbox_repo: OutboxRepository, event_bus: EventBus) -> None:
        self._outbox = outbox_repo
        self._bus = event_bus

    async def publish_pending(self, batch_size: int = 50) -> int:
        events = await self._outbox.fetch_pending(limit=batch_size)
        for event in events:
            await self._bus.publish(
                {
                    "event_type": event.event_type,
                    "event_version": event.event_version,
                    "aggregate_type": event.aggregate_type,
                    "aggregate_id": event.aggregate_id,
                    "payload": event.payload_json,
                    "correlation_id": event.correlation_id,
                }
            )
            await self._outbox.mark_published(event.id)
        return len(events)

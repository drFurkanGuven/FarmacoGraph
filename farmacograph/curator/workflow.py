"""Curator workflow state machine — FG-C023 enforced."""

from __future__ import annotations

from enum import Enum


class WorkflowState(str, Enum):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    PUBLISHED = "published"
    DEPRECATED = "deprecated"


# Valid transitions: from_state -> set of allowed to_states
# published → draft is admin unpublish (API gates with admin:org).
# published → deprecated is soft-delete (API gates with admin:org).
# deprecated → draft is admin restore (API gates with admin:org).
VALID_TRANSITIONS: dict[WorkflowState, set[WorkflowState]] = {
    WorkflowState.DRAFT: {WorkflowState.REVIEW},
    WorkflowState.REVIEW: {WorkflowState.DRAFT, WorkflowState.APPROVED},
    WorkflowState.APPROVED: {WorkflowState.PUBLISHED, WorkflowState.DRAFT},
    WorkflowState.PUBLISHED: {WorkflowState.DEPRECATED, WorkflowState.DRAFT},
    WorkflowState.DEPRECATED: {WorkflowState.DRAFT},
}


class InvalidTransitionError(Exception):
    def __init__(self, from_state: str, to_state: str) -> None:
        super().__init__(f"Invalid transition: {from_state} → {to_state}")
        self.from_state = from_state
        self.to_state = to_state


def validate_transition(from_state: str, to_state: str) -> None:
    try:
        from_ws = WorkflowState(from_state)
        to_ws = WorkflowState(to_state)
    except ValueError as exc:
        raise InvalidTransitionError(from_state, to_state) from exc
    allowed = VALID_TRANSITIONS.get(from_ws, set())
    if to_ws not in allowed:
        raise InvalidTransitionError(from_state, to_state)


def allowed_transitions(from_state: str) -> list[str]:
    try:
        from_ws = WorkflowState(from_state)
    except ValueError:
        return []
    return sorted(s.value for s in VALID_TRANSITIONS.get(from_ws, set()))

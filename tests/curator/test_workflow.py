"""Curator workflow state machine tests."""

import pytest

from farmacograph.curator.workflow import InvalidTransitionError, validate_transition


def test_draft_to_review_allowed():
    validate_transition("draft", "review")


def test_draft_to_published_forbidden():
    with pytest.raises(InvalidTransitionError):
        validate_transition("draft", "published")


def test_review_to_approved_allowed():
    validate_transition("review", "approved")


def test_approved_to_published_allowed():
    validate_transition("approved", "published")


def test_published_to_deprecated_allowed():
    validate_transition("published", "deprecated")


def test_deprecated_no_transitions():
    with pytest.raises(InvalidTransitionError):
        validate_transition("deprecated", "draft")

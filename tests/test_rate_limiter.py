"""Unit tests for sliding-window rate limiter."""

from farmacograph.api.middleware import RateLimiter


def test_rate_limiter_allows_under_limit():
    limiter = RateLimiter()
    for _ in range(5):
        allowed, remaining, _ = limiter.check("client_test_1", limit=10)
        assert allowed is True
    assert remaining == 5


def test_rate_limiter_blocks_over_limit():
    limiter = RateLimiter()
    limit = 3
    for _ in range(limit):
        allowed, _, _ = limiter.check("client_test_2", limit=limit)
        assert allowed is True

    # 4th request must be rejected
    allowed, remaining, reset_secs = limiter.check("client_test_2", limit=limit)
    assert allowed is False
    assert remaining == 0
    assert reset_secs > 0


def test_rate_limiter_distinct_clients():
    limiter = RateLimiter()
    allowed_a, _, _ = limiter.check("client_a", limit=1)
    allowed_b, _, _ = limiter.check("client_b", limit=1)
    assert allowed_a is True
    assert allowed_b is True

import pytest

from racedata import InvalidPayloadError, ProviderError, RateLimitedError, UpstreamUnavailableError


@pytest.mark.parametrize("error_type", [UpstreamUnavailableError, InvalidPayloadError])
def test_provider_errors_carry_the_provider_name(error_type: type[ProviderError]) -> None:
    error = error_type("openf1", "boom")

    assert isinstance(error, ProviderError)
    assert error.provider == "openf1"
    assert str(error) == "[openf1] boom"


def test_rate_limited_error_exposes_retry_after() -> None:
    error = RateLimitedError("jolpica", retry_after_s=2.5)

    assert error.retry_after_s == 2.5
    assert "retry after 2.5s" in str(error)


def test_rate_limited_error_without_retry_after() -> None:
    error = RateLimitedError("openf1")

    assert error.retry_after_s is None
    assert str(error) == "[openf1] rate limited"

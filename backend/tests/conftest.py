import pytest
from app.core.config import settings

@pytest.fixture(autouse=True)
def default_mock_ai_for_unit_tests(monkeypatch, request):
    """Ensures test suite runs fast and deterministically without exhausting cloud LLM rate limits.
    Tests specifically targeting cloud providers (e.g. test_llm_provider) override this fixture.
    """
    if "live_ai" not in request.keywords and "mock_settings" not in request.fixturenames:
        monkeypatch.setattr("app.services.ai.settings.AI_PROVIDER", "mock")
        monkeypatch.setattr("app.core.config.settings.AI_PROVIDER", "mock")
        try:
            from app.api.v1 import interviews
            monkeypatch.setattr(interviews.engine.provider, "provider_name", "mock")
            monkeypatch.setattr(interviews.engine.provider, "api_key", "")
        except Exception:
            pass


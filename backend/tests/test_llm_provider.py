import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.services.ai import (
    AIProvider,
    AIProviderError,
    EvaluationDTO,
    MAX_CHAT_HISTORY_MESSAGES,
    get_ai_status,
)
from app.main import app


@pytest.fixture
def mock_settings(monkeypatch):
    """Configures test settings with Gemini provider and a test key."""
    monkeypatch.setattr("app.services.ai.settings.AI_PROVIDER", "gemini")
    monkeypatch.setattr("app.services.ai.settings.AI_MODEL", "gemini-3.5-flash")
    monkeypatch.setattr("app.services.ai.settings.AI_API_KEY", "TEST_GEMINI_KEY_ABC123")


def test_ai_provider_initialization_gemini(mock_settings):
    provider = AIProvider()
    assert provider.provider_name == "gemini"
    assert provider.model == "gemini-3.5-flash"
    assert provider.api_key == "TEST_GEMINI_KEY_ABC123"
    assert provider.is_real_llm is True


def test_ai_provider_initialization_mock(monkeypatch):
    monkeypatch.setattr("app.services.ai.settings.AI_PROVIDER", "mock")
    monkeypatch.setattr("app.services.ai.settings.AI_MODEL", None)
    monkeypatch.setattr("app.services.ai.settings.AI_API_KEY", None)

    provider = AIProvider()
    assert provider.provider_name == "mock"
    assert provider.is_real_llm is False


def test_ai_status_does_not_leak_key(mock_settings):
    provider = AIProvider()
    status = provider.ai_status()
    assert status["provider"] == "gemini"
    assert status["model"] == "gemini-3.5-flash"
    assert status["api_key_configured"] is True
    assert status["is_real_llm"] is True
    assert "TEST_GEMINI_KEY_ABC123" not in str(status)


def test_redact_sanitizes_api_key(mock_settings):
    provider = AIProvider()
    text = "Failed call with key TEST_GEMINI_KEY_ABC123 in authorization header"
    redacted = provider._redact(text)
    assert "TEST_GEMINI_KEY_ABC123" not in redacted
    assert "[REDACTED_API_KEY]" in redacted


@patch("requests.post")
def test_call_llm_gemini_payload_and_header(mock_post, mock_settings):
    provider = AIProvider()

    # Mock response from Gemini
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": '{"result": "success"}'}]
                }
            }
        ]
    }
    mock_post.return_value = mock_resp

    history = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there"},
    ]
    result = provider._call_llm(
        prompt="Tell me about indexes",
        system="You are an expert",
        json_mode=True,
        history=history,
        timeout=10,
    )

    assert result == '{"result": "success"}'
    assert mock_post.called

    call_args = mock_post.call_args
    url = call_args[0][0]
    headers = call_args[1]["headers"]
    body = call_args[1]["json"]

    # Verify key is in header, NOT in URL
    assert "key=" not in url
    assert url == "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"
    assert headers.get("x-goog-api-key") == "TEST_GEMINI_KEY_ABC123"

    # Verify system instruction and JSON mode
    assert body.get("system_instruction") == {"parts": [{"text": "You are an expert"}]}
    assert body.get("generationConfig") == {"responseMimeType": "application/json"}

    # Verify history mapping: 'assistant' -> 'model'
    contents = body.get("contents", [])
    assert contents[0]["role"] == "user"
    assert contents[0]["parts"][0]["text"] == "Hello"
    assert contents[1]["role"] == "model"
    assert contents[1]["parts"][0]["text"] == "Hi there"
    assert contents[2]["role"] == "user"
    assert contents[2]["parts"][0]["text"] == "Tell me about indexes"


@patch("requests.post")
def test_call_llm_openai_payload_and_header(mock_post, monkeypatch):
    monkeypatch.setattr("app.services.ai.settings.AI_PROVIDER", "openai")
    monkeypatch.setattr("app.services.ai.settings.AI_MODEL", "gpt-4o-mini")
    monkeypatch.setattr("app.services.ai.settings.AI_API_KEY", "sk-TEST-OPENAI-KEY")

    provider = AIProvider()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {"content": '{"openai": "ok"}'}
            }
        ]
    }
    mock_post.return_value = mock_resp

    history = [
        {"role": "user", "content": "Question 1"},
        {"role": "model", "content": "Answer 1"},
    ]
    result = provider._call_llm(
        prompt="Question 2",
        system="Interviewer system prompt",
        json_mode=True,
        history=history,
        timeout=12,
    )

    assert result == '{"openai": "ok"}'
    call_args = mock_post.call_args
    url = call_args[0][0]
    headers = call_args[1]["headers"]
    body = call_args[1]["json"]

    assert url == "https://api.openai.com/v1/chat/completions"
    assert headers.get("Authorization") == "Bearer sk-TEST-OPENAI-KEY"
    assert body.get("model") == "gpt-4o-mini"
    assert body.get("response_format") == {"type": "json_object"}

    # Verify messages: system first, then mapped history (model -> assistant), then user
    msgs = body.get("messages", [])
    assert msgs[0] == {"role": "system", "content": "Interviewer system prompt"}
    assert msgs[1] == {"role": "user", "content": "Question 1"}
    assert msgs[2] == {"role": "assistant", "content": "Answer 1"}
    assert msgs[3] == {"role": "user", "content": "Question 2"}


@patch("requests.post")
def test_call_llm_json_strips_markdown_codeblock(mock_post, mock_settings):
    provider = AIProvider()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "```json\n{\"status\": \"clean\"}\n```"}]
                }
            }
        ]
    }
    mock_post.return_value = mock_resp

    data = provider._call_llm_json("Return status")
    assert data == {"status": "clean"}


@patch("requests.post")
def test_call_llm_history_truncation(mock_post, mock_settings):
    provider = AIProvider()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "{}"}]}}]
    }
    mock_post.return_value = mock_resp

    # Pass 20 messages in history
    long_history = [{"role": "user", "content": f"Msg {i}"} for i in range(20)]
    provider._call_llm("New message", history=long_history)

    call_args = mock_post.call_args
    body = call_args[1]["json"]
    contents = body["contents"]

    # History should be capped at MAX_CHAT_HISTORY_MESSAGES (10) + 1 for current prompt = 11
    assert len(contents) <= MAX_CHAT_HISTORY_MESSAGES + 1


@patch("requests.post")
def test_evaluate_answer_hard_relevance_gate(mock_post, mock_settings):
    provider = AIProvider()

    # Return low relevance (< 0.4) with high raw score (9)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "score": 9,
                                "correctness": 0.8,
                                "relevance": 0.25,
                                "technical_depth": 0.7,
                                "communication_quality": 0.8,
                                "strengths": ["Clear speech"],
                                "weaknesses": ["Irrelevant to question"],
                                "feedback": "Answer wandered off topic.",
                            })
                        }
                    ]
                }
            }
        ]
    }
    mock_post.return_value = mock_resp

    evaluation = provider.evaluate_answer(
        question="Explain useEffect in React",
        answer="I like cooking pizza in the evening.",
    )

    assert isinstance(evaluation, EvaluationDTO)
    assert evaluation.relevance == 0.25
    # Strict code gate caps score at 2
    assert evaluation.score <= 2


@patch("requests.post")
def test_evaluate_answer_hard_correctness_gate(mock_post, mock_settings):
    provider = AIProvider()

    # Return low correctness (0.2) with raw score (7)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "score": 7,
                                "correctness": 0.2,
                                "relevance": 0.8,
                                "technical_depth": 0.3,
                                "communication_quality": 0.8,
                                "strengths": ["Related topic"],
                                "weaknesses": ["Factually incorrect"],
                                "feedback": "Incorrect mechanics.",
                            })
                        }
                    ]
                }
            }
        ]
    }
    mock_post.return_value = mock_resp

    evaluation = provider.evaluate_answer(
        question="How does hash indexing work?",
        answer="It sorts everything alphabetically in a tree.",
    )

    assert isinstance(evaluation, EvaluationDTO)
    assert evaluation.correctness == 0.2
    # Strict code gate caps score at 3
    assert evaluation.score <= 3


@patch("requests.post")
def test_error_fallback_to_mock(mock_post, mock_settings):
    provider = AIProvider()
    mock_post.side_effect = Exception("Google API 503 Service Unavailable")

    # evaluate_answer should gracefully fall back to deterministic mock evaluation
    evaluation = provider.evaluate_answer(
        question="What is a Python decorator?",
        answer="A decorator is a function that takes another function and extends its behavior.",
    )
    assert isinstance(evaluation, EvaluationDTO)
    assert evaluation.score >= 0


def test_health_endpoints_include_ai_status():
    client = TestClient(app)

    # Root health endpoint
    res_root = client.get("/health")
    assert res_root.status_code == 200
    root_json = res_root.json()
    assert "ai" in root_json
    assert "provider" in root_json["ai"]
    assert "model" in root_json["ai"]
    assert "api_key_configured" in root_json["ai"]

    # API v1 health endpoint
    res_v1 = client.get("/api/v1/health")
    assert res_v1.status_code == 200
    v1_json = res_v1.json()
    assert "ai" in v1_json
    assert "provider" in v1_json["ai"]
    assert "model" in v1_json["ai"]


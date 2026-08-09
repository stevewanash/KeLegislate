import pytest
from unittest.mock import MagicMock, patch
from pydantic import BaseModel
from google.genai.errors import APIError, ClientError

from app.agents.gemini_client import (
    GeminiResponse,
    get_gemini_client,
    call_gemini,
    count_tokens,
)
from app.config import settings

class SampleSchema(BaseModel):
    summary: str
    key_points: list[str]

def test_gemini_response_schema():
    resp = GeminiResponse(
        text="Sample output",
        prompt_tokens=10,
        completion_tokens=20,
        total_tokens=30,
        latency_ms=150.5,
        model_name="gemini-2.5-flash",
    )
    assert resp.text == "Sample output"
    assert resp.prompt_tokens == 10
    assert resp.completion_tokens == 20
    assert resp.total_tokens == 30
    assert resp.latency_ms == 150.5
    assert resp.model_name == "gemini-2.5-flash"

def test_call_gemini_success_mock():
    mock_client = MagicMock()
    
    mock_usage = MagicMock()
    mock_usage.prompt_token_count = 50
    mock_usage.candidates_token_count = 100
    mock_usage.total_token_count = 150
    
    mock_response = MagicMock()
    mock_response.text = "Analysis result"
    mock_response.parsed = None
    mock_response.usage_metadata = mock_usage

    mock_client.models.generate_content.return_value = mock_response

    result = call_gemini(
        prompt="Analyze this text",
        system_instruction="You are an analyst",
        model="gemini-2.5-flash",
        temperature=0.3,
        client=mock_client,
    )

    assert result.text == "Analysis result"
    assert result.prompt_tokens == 50
    assert result.completion_tokens == 100
    assert result.total_tokens == 150
    assert result.latency_ms > 0
    assert result.model_name == "gemini-2.5-flash"

    mock_client.models.generate_content.assert_called_once()
    _, kwargs = mock_client.models.generate_content.call_args
    assert kwargs["model"] == "gemini-2.5-flash"
    assert kwargs["contents"] == "Analyze this text"
    assert kwargs["config"].temperature == 0.3
    assert kwargs["config"].system_instruction == "You are an analyst"

def test_call_gemini_structured_output_mock():
    mock_client = MagicMock()
    
    mock_response = MagicMock()
    mock_response.text = '{"summary": "Test", "key_points": ["a", "b"]}'
    mock_response.parsed = SampleSchema(summary="Test", key_points=["a", "b"])
    mock_response.usage_metadata = MagicMock(
        prompt_token_count=20, candidates_token_count=30, total_token_count=50
    )

    mock_client.models.generate_content.return_value = mock_response

    result = call_gemini(
        prompt="Summarize item",
        response_schema=SampleSchema,
        client=mock_client,
    )

    assert result.parsed.summary == "Test"
    assert result.parsed.key_points == ["a", "b"]
    
    _, kwargs = mock_client.models.generate_content.call_args
    assert kwargs["config"].response_schema == SampleSchema
    assert kwargs["config"].response_mime_type == "application/json"

def test_call_gemini_transient_retry_success():
    mock_client = MagicMock()

    mock_usage = MagicMock(prompt_token_count=10, candidates_token_count=10, total_token_count=20)
    success_response = MagicMock(text="Retry success", parsed=None, usage_metadata=mock_usage)

    # APIError / ClientError with status code 429 (rate limit) on 1st call, success on 2nd
    transient_error = ClientError(429, {"message": "Rate limit exceeded"})
    mock_client.models.generate_content.side_effect = [transient_error, success_response]

    with patch("time.sleep", return_value=None):
        result = call_gemini(
            prompt="Hello",
            client=mock_client,
            max_retries=2,
            backoff_factor=0.01,
        )

    assert result.text == "Retry success"
    assert mock_client.models.generate_content.call_count == 2

def test_call_gemini_permanent_error_raises():
    mock_client = MagicMock()
    permanent_error = ClientError(400, {"message": "Invalid request"})
    mock_client.models.generate_content.side_effect = permanent_error

    with pytest.raises(APIError):
        call_gemini(
            prompt="Bad prompt",
            client=mock_client,
            max_retries=2,
        )
    assert mock_client.models.generate_content.call_count == 1

def test_count_tokens_mock():
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.total_tokens = 42
    mock_client.models.count_tokens.return_value = mock_result

    count = count_tokens("Short sentence", client=mock_client)
    assert count == 42
    mock_client.models.count_tokens.assert_called_once_with(
        model="gemini-2.5-flash", contents="Short sentence"
    )

@pytest.mark.skipif(
    not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("mock"),
    reason="Requires valid non-mock GEMINI_API_KEY environment variable",
)
def test_call_gemini_live_integration():
    try:
        result = call_gemini(
            prompt="Respond with the single word 'OK'.",
            temperature=0.0,
            max_retries=1,
            backoff_factor=0.1,
        )
        assert "OK" in result.text
        assert result.total_tokens > 0
        assert result.latency_ms > 0
    except APIError as e:
        # If API key quota/credits are depleted (429 / RESOURCE_EXHAUSTED), mark as expected transient API limitation
        if getattr(e, "code", None) == 429 or "EXHAUSTED" in str(e):
            pytest.skip(f"Gemini API quota/credits currently unavailable: {e}")
        else:
            raise e

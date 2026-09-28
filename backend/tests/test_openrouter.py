"""OpenRouter client against a mocked HTTP transport (no network in tests)."""

import json

import httpx
import pytest

from app.services.ai.base import AIProviderError
from app.services.ai.openrouter import OpenRouterProvider

MESSAGES = [{"role": "user", "content": "hi"}]


def provider(handler, **kwargs) -> tuple[OpenRouterProvider, list[float]]:
    sleeps: list[float] = []
    p = OpenRouterProvider(
        base_url="https://openrouter.test/api/v1/",
        api_key="sk-or-test-key-123456",
        transport=httpx.MockTransport(handler),
        sleep=sleeps.append,
        **kwargs,
    )
    return p, sleeps


def completion(content="Hello!", model="meta/free-model:free"):
    return {
        "model": model,
        "choices": [{"message": {"role": "assistant", "content": content}}],
        "usage": {"prompt_tokens": 12, "completion_tokens": 3},
    }


def complete(p):
    return p.complete(MESSAGES, model="meta/free-model:free", temperature=0.3, max_tokens=256)


def test_request_shape_and_headers():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["headers"] = request.headers
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=completion())

    p, _ = provider(handler)
    result = complete(p)
    assert result.content == "Hello!" and result.prompt_tokens == 12
    assert seen["url"] == "https://openrouter.test/api/v1/chat/completions"
    assert seen["headers"]["authorization"] == "Bearer sk-or-test-key-123456"
    assert seen["headers"]["x-title"] == "EgSA AI Engineering Platform"
    assert seen["body"] == {
        "model": "meta/free-model:free",
        "messages": MESSAGES,
        "temperature": 0.3,
        "max_tokens": 256,
        "stream": False,
        "usage": {"include": True},
    }


def test_list_models_flags_free_ones():
    def handler(request):
        return httpx.Response(
            200,
            json={
                "data": [
                    {"id": "a/free:free", "name": "A Free", "pricing": {"prompt": "0.5"}},
                    {"id": "b/zero", "name": "B", "pricing": {"prompt": "0", "completion": "0"}},
                    {"id": "c/paid", "pricing": {"prompt": "0.000001", "completion": "0.000002"}},
                ]
            },
        )

    p, _ = provider(handler)
    models = {m.id: m for m in p.list_models()}
    assert models["a/free:free"].is_free and models["b/zero"].is_free
    assert not models["c/paid"].is_free and models["c/paid"].name == "c/paid"


@pytest.mark.parametrize(
    ("status", "body", "code"),
    [
        (401, {"error": {"message": "No auth"}}, "AI_AUTH_FAILED"),
        (402, {"error": {"message": "Insufficient credits"}}, "AI_NO_CREDITS"),
        (404, {"error": {"message": "Model not found: x"}}, "AI_MODEL_NOT_FOUND"),
        (400, {"error": {"message": "bad request"}}, "AI_REQUEST_FAILED"),
    ],
)
def test_error_mapping_without_retry(status, body, code):
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(status, json=body)

    p, sleeps = provider(handler)
    with pytest.raises(AIProviderError) as exc:
        complete(p)
    assert exc.value.code == code
    assert len(calls) == 1 and sleeps == []  # client errors are not retried


def test_rate_limit_is_retried_then_succeeds():
    responses = iter(
        [httpx.Response(429), httpx.Response(503), httpx.Response(200, json=completion())]
    )
    p, sleeps = provider(lambda r: next(responses))
    assert complete(p).content == "Hello!"
    assert sleeps == [0.5, 1.0]  # exponential backoff


def test_rate_limit_exhausted():
    p, sleeps = provider(lambda r: httpx.Response(429))
    with pytest.raises(AIProviderError) as exc:
        complete(p)
    assert exc.value.code == "AI_RATE_LIMITED"
    assert "busy" in exc.value.message and len(sleeps) == 2


def test_timeout_and_network_errors():
    def timeout(request):
        raise httpx.ReadTimeout("slow", request=request)

    def offline(request):
        raise httpx.ConnectError("down", request=request)

    for handler, code in [(timeout, "AI_TIMEOUT"), (offline, "AI_UNAVAILABLE")]:
        p, _ = provider(handler)
        with pytest.raises(AIProviderError) as exc:
            complete(p)
        assert exc.value.code == code


def sse_body(*events: str) -> bytes:
    return "".join(f"{e}\n\n" for e in events).encode()


def chunk(text="", **extra):
    return "data: " + json.dumps({"choices": [{"delta": {"content": text}}], **extra})


def test_stream_parses_deltas_comments_usage_and_done():
    body = sse_body(
        ": OPENROUTER PROCESSING",
        chunk("Hel", model="meta/free-model:free"),
        chunk("lo"),
        chunk("", usage={"prompt_tokens": 9, "completion_tokens": 2}),
        "data: [DONE]",
        chunk("ignored after done"),
    )
    p, _ = provider(lambda r: httpx.Response(200, content=body))
    chunks = list(p.stream(MESSAGES, model="m", temperature=0, max_tokens=64))
    assert "".join(c.delta for c in chunks) == "Hello"
    assert chunks[0].model == "meta/free-model:free"
    assert chunks[-1].prompt_tokens == 9 and chunks[-1].completion_tokens == 2


def test_stream_error_event_raises():
    body = sse_body(chunk("partial"), 'data: {"error": {"message": "Provider overloaded"}}')
    p, _ = provider(lambda r: httpx.Response(200, content=body))
    stream = p.stream(MESSAGES, model="m", temperature=0, max_tokens=64)
    assert next(stream).delta == "partial"
    with pytest.raises(AIProviderError) as exc:
        next(stream)
    assert "overloaded" in exc.value.message


def test_stream_http_error_before_start_is_mapped():
    p, _ = provider(lambda r: httpx.Response(401, json={"error": {"message": "bad key"}}))
    with pytest.raises(AIProviderError) as exc:
        list(p.stream(MESSAGES, model="m", temperature=0, max_tokens=64))
    assert exc.value.code == "AI_AUTH_FAILED"


def test_check_key_uses_the_key_endpoint():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        if request.headers["authorization"] != "Bearer sk-or-test-key-123456":
            return httpx.Response(401, json={"error": {"message": "User not found."}})
        return httpx.Response(200, json={"data": {"label": "egsa", "is_free_tier": True}})

    p, _ = provider(handler)
    info = p.check_key()
    assert seen["path"] == "/api/v1/key" and info.label == "egsa" and info.is_free_tier

    bad = OpenRouterProvider(
        base_url="https://openrouter.test/api/v1",
        api_key="wrong",
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(AIProviderError) as exc:
        bad.check_key()
    assert exc.value.code == "AI_AUTH_FAILED"

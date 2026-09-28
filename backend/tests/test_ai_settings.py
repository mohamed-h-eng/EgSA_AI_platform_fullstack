"""Admin-managed OpenRouter connection (entered in Admin Settings, not in .env)."""

import pytest
from sqlalchemy import select

from app.models.ai import AISettings
from app.models.audit import AuditLog
from app.services.ai import settings as ai_settings
from app.services.ai.base import AIProviderError
from tests.ai_fakes import FakeProvider
from tests.conftest import auth_header, login

API = "/api/v1"
# Fake key: hyphenated so it never matches the real-key pattern the secret scan looks for.
KEY = "sk-or-v1-fake-test-key-0123456789-abcdef"


@pytest.fixture
def fake(monkeypatch) -> FakeProvider:
    fake = FakeProvider()

    def make(base_url: str, api_key: str) -> FakeProvider:
        fake.base_url, fake.api_key = base_url, api_key
        return fake

    monkeypatch.setattr(ai_settings, "make_provider", make)
    ai_settings._catalog_cache.clear()
    return fake


@pytest.fixture
def admin(client, make_user):
    make_user("admin@egsa.local", role="admin")
    return auth_header(login(client, "admin@egsa.local").json()["access_token"])


@pytest.fixture
def engineer(client, make_user):
    make_user("eng@egsa.local", role="engineer")
    return auth_header(login(client, "eng@egsa.local").json()["access_token"])


def put(client, headers, **body):
    return client.put(f"{API}/admin/ai/config", headers=headers, json=body)


def test_default_config_is_not_configured(client, admin):
    config = client.get(f"{API}/admin/ai/config", headers=admin).json()
    assert config["configured"] is False
    assert config["api_key_set"] is False and config["api_key_hint"] is None
    assert config["base_url"] == "https://openrouter.ai/api/v1"
    assert config["default_model"] is None and config["allowed_models"] == []
    assert "EgSA" in config["system_prompt"]


def test_api_key_is_write_only_encrypted_and_never_audited(client, admin, db):
    res = put(client, admin, api_key=f"  {KEY}  ", default_model="meta-llama/llama-free:free")
    assert res.status_code == 200
    body = res.json()
    assert body["api_key_set"] is True and body["api_key_hint"] == "…cdef"
    assert body["configured"] is True
    assert KEY not in res.text  # never echoed back

    db.expire_all()
    row = db.get(AISettings, 1)
    assert row.api_key_encrypted and KEY not in row.api_key_encrypted  # encrypted at rest
    audit = [a for a in db.scalars(select(AuditLog)) if a.action == "settings.ai_update"]
    assert audit and all(KEY not in str(a.meta) and "cdef" not in str(a.meta) for a in audit)
    assert "api_key" in audit[-1].meta["changed"]

    # GET also never returns it.
    assert KEY not in client.get(f"{API}/admin/ai/config", headers=admin).text


def test_saving_without_a_key_keeps_the_existing_one(client, admin):
    put(client, admin, api_key=KEY)
    res = put(client, admin, temperature=0.7)
    assert res.json()["api_key_set"] is True and res.json()["temperature"] == 0.7


def test_clear_api_key(client, admin):
    put(client, admin, api_key=KEY, default_model="meta-llama/llama-free:free")
    cleared = put(client, admin, clear_api_key=True).json()
    assert cleared["api_key_set"] is False and cleared["configured"] is False


def test_default_model_is_always_allowed(client, admin):
    body = put(
        client,
        admin,
        allowed_models=["mistral/mistral-free:free", " ", "mistral/mistral-free:free"],
        default_model="meta-llama/llama-free:free",
    ).json()
    assert body["allowed_models"] == ["meta-llama/llama-free:free", "mistral/mistral-free:free"]


def test_validation(client, admin):
    assert put(client, admin, base_url="openrouter.ai").status_code == 422
    assert put(client, admin, temperature=3).status_code == 422
    assert put(client, admin, api_key="short").status_code == 422
    put(client, admin, default_model="meta-llama/llama-free:free")
    res = put(client, admin, default_model=None)
    assert res.json()["error"]["code"] == "DEFAULT_MODEL_REQUIRED"


def test_only_admins_manage_ai_settings(client, engineer):
    assert client.get(f"{API}/admin/ai/config", headers=engineer).status_code == 403
    assert put(client, engineer, temperature=0.1).status_code == 403
    assert client.post(f"{API}/admin/ai/config/test", headers=engineer, json={}).status_code == 403


def test_connection_test_uses_the_typed_key_without_saving(client, admin, fake, db):
    res = client.post(f"{API}/admin/ai/config/test", headers=admin, json={"api_key": KEY})
    body = res.json()
    assert body["ok"] is True and body["model_count"] == 3 and body["free_model_count"] == 2
    assert fake.api_key == KEY
    assert client.get(f"{API}/admin/ai/config", headers=admin).json()["api_key_set"] is False

    fake.fail = AIProviderError("AI_AUTH_FAILED", "OpenRouter rejected the API key.")
    failed = client.post(f"{API}/admin/ai/config/test", headers=admin, json={"api_key": KEY}).json()
    assert failed == {
        "ok": False,
        "message": "OpenRouter rejected the API key.",
        "model_count": 0,
        "free_model_count": 0,
    }

    nothing = client.post(f"{API}/admin/ai/config/test", headers=admin, json={}).json()
    assert nothing["ok"] is False


def test_connection_test_rejects_a_bad_key_even_though_models_are_public(client, admin, fake):
    """Regression: OpenRouter's /models works without auth, so listing models alone would
    report 'connected' for an invalid key."""
    fake.key_rejected = True
    res = client.post(f"{API}/admin/ai/config/test", headers=admin, json={"api_key": KEY}).json()
    assert res["ok"] is False and "rejected" in res["message"]


def test_available_models_lists_free_ones(client, admin, fake):
    no_key = client.get(f"{API}/admin/ai/models", headers=admin)
    assert no_key.json()["error"]["code"] == "AI_NOT_CONFIGURED"
    put(client, admin, api_key=KEY)
    free = client.get(f"{API}/admin/ai/models", headers=admin).json()
    assert [m["id"] for m in free] == ["meta-llama/llama-free:free", "mistral/mistral-free:free"]
    everything = client.get(
        f"{API}/admin/ai/models", headers=admin, params={"free_only": False}
    ).json()
    assert len(everything) == 3


def test_chat_users_see_only_the_allow_list(client, admin, engineer, fake):
    put(client, admin, api_key=KEY, default_model="meta-llama/llama-free:free")
    client.get(f"{API}/admin/ai/models", headers=admin)  # warms the name cache
    models = client.get(f"{API}/ai/models", headers=engineer).json()
    assert models["configured"] is True
    assert models["default_model"] == "meta-llama/llama-free:free"
    assert models["models"] == [{"id": "meta-llama/llama-free:free", "name": "Llama Free"}]
    assert KEY not in client.get(f"{API}/ai/models", headers=engineer).text


def test_unreadable_key_after_secret_change(client, admin, monkeypatch):
    from app.core.config import get_settings

    put(client, admin, api_key=KEY, default_model="meta-llama/llama-free:free")
    monkeypatch.setattr(get_settings(), "app_encryption_key", "a-different-secret")
    config = client.get(f"{API}/admin/ai/config", headers=admin).json()
    assert config["api_key_unreadable"] is True
    assert config["api_key_set"] is False and config["configured"] is False

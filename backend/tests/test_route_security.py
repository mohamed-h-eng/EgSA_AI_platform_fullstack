"""Every API operation must require authentication unless it is explicitly public.

Uses the OpenAPI schema (a public, stable interface): every protected route depends on the
HTTPBearer scheme through `_get_pending_user`, which FastAPI declares as `security`.
"""

from app.main import create_app

PUBLIC_OPERATIONS = {
    ("GET", "/api/v1/health"),
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/refresh"),  # authenticated by the refresh cookie
    ("POST", "/api/v1/auth/logout"),  # authenticated by the refresh cookie
}


def _operations() -> dict[tuple[str, str], dict]:
    schema = create_app().openapi()
    return {
        (method.upper(), path): operation
        for path, methods in schema["paths"].items()
        for method, operation in methods.items()
    }


def test_every_operation_requires_auth_unless_public():
    operations = _operations()
    assert len(operations) > len(PUBLIC_OPERATIONS)  # guard against checking nothing
    unprotected = sorted(
        key
        for key, op in operations.items()
        if key not in PUBLIC_OPERATIONS
        and not any("HTTPBearer" in requirement for requirement in op.get("security", []))
    )
    assert unprotected == [], f"Operations without authentication: {unprotected}"


def test_public_allow_list_has_no_stale_entries():
    assert set(_operations()) >= PUBLIC_OPERATIONS

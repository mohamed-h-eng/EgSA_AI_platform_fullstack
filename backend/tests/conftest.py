import os

# Tests run against in-memory SQLite unless a test database URL is provided.
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", "sqlite+pysqlite://"))
os.environ.setdefault("JWT_SECRET", "test-secret-with-enough-length-for-hs256")
os.environ.setdefault("BCRYPT_ROUNDS", "4")  # minimum cost: tests only

from collections.abc import Callable, Iterator  # noqa: E402

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402, F401
from app.core.security import hash_password  # noqa: E402
from app.database.base import Base  # noqa: E402
from app.database.seed import seed_permissions_and_roles  # noqa: E402
from app.database.session import get_db, get_session_factory  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.role import Role  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.auth.service import login_limiter  # noqa: E402
from app.services.documents.service import seed_categories  # noqa: E402
from app.storage import LocalStorage, get_storage  # noqa: E402

DEFAULT_PASSWORD = "Correct-Horse-42"


@pytest.fixture
def db_engine():
    engine = create_engine(
        "sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session_factory(db_engine) -> sessionmaker[Session]:
    factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    with factory() as db:
        seed_permissions_and_roles(db)
        seed_categories(db)
        db.commit()
    return factory


@pytest.fixture
def db(session_factory) -> Iterator[Session]:
    with session_factory() as session:
        yield session


@pytest.fixture
def storage(tmp_path) -> LocalStorage:
    return LocalStorage(tmp_path / "storage")


@pytest.fixture
def app(session_factory, storage) -> FastAPI:
    application = create_app()
    application.dependency_overrides[get_storage] = lambda: storage

    def _get_db() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    application.dependency_overrides[get_db] = _get_db
    application.dependency_overrides[get_session_factory] = lambda: session_factory
    login_limiter.clear()
    return application


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture
def make_user(db: Session) -> Callable[..., User]:
    def _make(
        email: str = "engineer@egsa.local",
        *,
        role: str = "engineer",
        password: str = DEFAULT_PASSWORD,
        is_active: bool = True,
        must_change_password: bool = False,
        full_name: str = "Test User",
    ) -> User:
        role_obj = db.scalar(select(Role).where(Role.code == role))
        user = User(
            email=email,
            full_name=full_name,
            password_hash=hash_password(password),
            is_active=is_active,
            must_change_password=must_change_password,
            roles=[role_obj] if role_obj else [],
        )
        db.add(user)
        db.commit()
        return user

    return _make


def login(client: TestClient, email: str, password: str = DEFAULT_PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

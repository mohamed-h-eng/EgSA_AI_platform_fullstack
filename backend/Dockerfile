# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_SYSTEM_CERTS=1 \
    UV_HTTP_TIMEOUT=120 \
    UV_HTTP_RETRIES=5 \
    UV_CONCURRENT_DOWNLOADS=4

# Optional: extra corporate CA certificate(s) for networks with TLS inspection.
# Put *.crt files in backend/certs/ (the folder may be empty).
COPY certs/ /usr/local/share/ca-certificates/
RUN update-ca-certificates

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .

RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /data/storage \
    && chown -R appuser /app /data/storage
USER appuser

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m app.database.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]

# MediLedger Nigeria — AI Service
# Python 3.11 + uv for fast, reproducible dependency resolution
# ─────────────────────────────────────────────────────────────

# ── Stage 1: dependency resolver ─────────────────────────────
FROM python:3.11-slim AS resolver

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.4.15 /uv /uvx /bin/

WORKDIR /build

COPY pyproject.toml uv.lock* ./

# Compile locked requirements; skip dev extras
RUN uv export --frozen --no-dev --output-file requirements-locked.txt \
    || uv lock && uv export --no-dev --output-file requirements-locked.txt


# ── Stage 2: runtime image ────────────────────────────────────
FROM python:3.11-slim AS runtime

# Install uv into the final image (used to run the app)
COPY --from=ghcr.io/astral-sh/uv:0.4.15 /uv /uvx /bin/

# System deps: needed for torch native libs and opacus
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy locked deps from resolver stage
COPY --from=resolver /build/pyproject.toml /build/uv.lock* ./

# Install into the system Python (no venv) — uv handles isolation via lock file
RUN uv sync --frozen --no-dev

# Copy application source
COPY . .

# Non-root user for runtime security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 3008

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3008/health')"

CMD ["uv", "run", "uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "3008", \
     "--workers", "2", \
     "--log-level", "info"]

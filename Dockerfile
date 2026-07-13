# ============================================================
# OMPC Unified Platform - All-in-One Docker Image
# Frontend (Next.js, port 60010) + Backend (FastAPI, port 60011)
# ============================================================

# ---------- Stage 1: Build Next.js frontend ----------
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Build backend + runtime ----------
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js runtime for Next.js standalone
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install backend Python dependencies
COPY test_backend/pyproject.toml ./
COPY test_backend/app/ ./app/
COPY prompts/ ./prompts/
RUN pip install --no-cache-dir .

# Copy frontend standalone build
COPY --from=frontend-builder /frontend/.next/standalone /app/frontend/
COPY --from=frontend-builder /frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /frontend/public /app/frontend/public

# Create directories
RUN mkdir -p /app/data /app/static/generated /app/artifacts/dev

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Frontend on 60010, Backend on 60011
EXPOSE 60010 60011

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
    CMD curl -f http://127.0.0.1:60011/health || exit 1

CMD ["/app/entrypoint.sh"]

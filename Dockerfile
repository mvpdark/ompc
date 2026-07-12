# OMPC Shell - Web Framework Container
# Provides unified backend API with domain registry for sub-projects
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY test_backend/pyproject.toml ./
COPY test_backend/app/ ./app/
RUN pip install --no-cache-dir .

# Create data and static directories
RUN mkdir -p /app/data /app/static/generated /app/artifacts/dev

# Copy entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# OMPC shell runs on port 60010
EXPOSE 60010

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
    CMD curl -f http://127.0.0.1:60010/health || exit 1

CMD ["./entrypoint.sh"]

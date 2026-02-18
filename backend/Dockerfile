FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy application code
COPY . .

# Make startup script executable
RUN chmod +x scripts/start.sh

EXPOSE 8000

# Production startup: run migrations + seed + start uvicorn
# (no --reload flag — that's for development only)
CMD ["scripts/start.sh"]

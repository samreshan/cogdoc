# FastAPI RAG service for Cogdoc (Sprint 1+).
# Builds the scientifically-important half of the system: embedding, vector
# retrieval, citation verification.
FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application.
COPY app/ ./app/
COPY pytest.ini .

EXPOSE 8000

# Run uvicorn; in production the host is overridden by the orchestrator.
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]

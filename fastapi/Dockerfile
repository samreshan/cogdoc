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
# create_app_from_env resolves the embedder + store from EMBEDDING_PROVIDER /
# GEMINI_API_KEY / SUPABASE_DB_URL (ADR-0008); unset env falls back to the
# hermetic HashingEmbedder + in-memory store.
CMD ["uvicorn", "app.main:create_app_from_env", "--factory", "--host", "0.0.0.0", "--port", "8000"]

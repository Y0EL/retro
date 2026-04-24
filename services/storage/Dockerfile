FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt fastapi uvicorn[standard]

COPY retro/ ./retro/
COPY services/storage/ ./services/storage/

VOLUME ["/app/data"]
ENV DB_PATH=/app/data/retro.db

CMD ["uvicorn", "services.storage.main:app", "--host", "0.0.0.0", "--port", "8006"]

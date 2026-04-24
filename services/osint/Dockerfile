FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt fastapi uvicorn[standard]

COPY retro/ ./retro/
COPY services/osint/ ./services/osint/

CMD ["uvicorn", "services.osint.main:app", "--host", "0.0.0.0", "--port", "8004"]

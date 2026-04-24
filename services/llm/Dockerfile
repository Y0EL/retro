FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt fastapi uvicorn[standard]

COPY retro/ ./retro/
COPY templates/ ./templates/
COPY services/llm/ ./services/llm/

CMD ["uvicorn", "services.llm.main:app", "--host", "0.0.0.0", "--port", "8003"]

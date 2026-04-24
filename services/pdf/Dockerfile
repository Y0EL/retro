FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt fastapi uvicorn[standard]

COPY retro/ ./retro/
COPY templates/ ./templates/
COPY services/pdf/ ./services/pdf/

CMD ["uvicorn", "services.pdf.main:app", "--host", "0.0.0.0", "--port", "8005"]

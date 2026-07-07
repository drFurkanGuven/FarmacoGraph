FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY farmacograph ./farmacograph
COPY ontology ./ontology
COPY openapi ./openapi
COPY configs ./configs
COPY architecture ./architecture
COPY staging ./staging

RUN pip install --no-cache-dir -e ".[api,graph,db,auth,observability]"

ENV FG_ENVIRONMENT=production
ENV FG_HOST=0.0.0.0
ENV FG_PORT=8000

EXPOSE 8000

CMD ["uvicorn", "farmacograph.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

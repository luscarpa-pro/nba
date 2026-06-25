FROM python:3.12-slim

WORKDIR /app

# Dipendenze runtime
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Codice cliente (NON modifichiamo questi file)
COPY nba_api.py nba_engine.py nba_config.py nba_catalog.py ./
COPY dataset.json nba_config.json trigger_catalog_base.json trigger_catalog_overrides.json ./
COPY static/ ./static/

# Estensione Tangible (isolata)
COPY tangible_lab/ ./tangible_lab/

# Path persistenti (Render Disk monterà /data)
ENV TANGIBLE_LAB_DATA_DIR=/data
RUN mkdir -p /data

# In produzione: forza cookie secure (HTTPS only)
ENV TANGIBLE_LAB_SECURE_COOKIE=1

# Render passa la PORT a runtime
ENV PORT=8000
EXPOSE 8000

# Gunicorn con worker uvicorn:
#  - 2 worker per resilienza (se uno crasha l'altro tiene)
#  - --timeout 60 per richieste un po' lente (preview NBA con config inline)
#  - --graceful-timeout 25 per dare al worker tempo di chiudere le request in corso
#  - --max-requests con jitter per riciclare worker che potrebbero leakare memoria
CMD ["sh", "-c", "gunicorn tangible_lab.server:app -k uvicorn.workers.UvicornWorker -w 2 --bind 0.0.0.0:${PORT} --timeout 60 --graceful-timeout 25 --max-requests 1000 --max-requests-jitter 100 --access-logfile - --error-logfile -"]

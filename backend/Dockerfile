FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
 && rm -rf /var/lib/apt/lists/*

RUN pip install uv

WORKDIR /app

# Install deps first (better layer caching)
COPY requirements.txt ./
RUN uv pip install --system -r requirements.txt

# Copy app source
COPY . .

EXPOSE 8000

# 2 workers — tune to (2 × CPU cores) + 1 for your instance size
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

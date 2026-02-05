FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY src/ ./src/
COPY pyproject.toml .

# Copy alembic for migrations
COPY alembic/ ./alembic/
COPY alembic.ini .

# Copy scripts for maintenance
COPY scripts/ ./scripts/

# Install the application
RUN pip install --no-cache-dir -e .

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Expose the port
EXPOSE 8080

# Run the application
CMD ["uvicorn", "city_api.main:app", "--host", "0.0.0.0", "--port", "8080"]

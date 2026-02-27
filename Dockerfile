# ---------- Stage 1: Build React frontend ----------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build production app
RUN npm run build

# ---------- Stage 2: Python backend + built frontend ----------
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (optional, but useful if any deps need build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
  && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist/

# Set working directory for the app
WORKDIR /app/backend

# Railway will inject PORT; default to 8000 for local usage
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
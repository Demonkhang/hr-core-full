# ---- Stage 1: cài dependencies ----
FROM python:3.12-slim AS deps

WORKDIR /app

# asyncpg cần libpq ở runtime; curl dùng cho HEALTHCHECK
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---- Stage 2: image chạy production ----
FROM python:3.12-slim

WORKDIR /app

# Chỉ cần libpq5 ở runtime (curl cho healthcheck)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Copy packages đã cài từ stage deps
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Tạo user non-root và cấp quyền
RUN useradd -m -u 10001 app

# Copy mã nguồn ứng dụng (trước đây bị thiếu → image không khởi động được)
COPY --chown=app:app . .

USER app

EXPOSE 8000

# HEALTHCHECK dùng endpoint /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# Production: KHÔNG dùng --reload. Dùng --workers để tận dụng đa lõi.
# --no-server-header giấu version uvicorn.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--no-server-header"]

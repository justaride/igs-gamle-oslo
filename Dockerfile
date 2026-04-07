# --- Server build ---
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

FROM node:20-alpine AS server
WORKDIR /app
COPY --from=server-build /app/server/dist ./dist
COPY server/migrations ./migrations
COPY --from=server-build /app/server/node_modules ./node_modules
COPY --from=server-build /app/server/package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]

# --- Pipeline build/runtime ---
FROM python:3.12-slim AS pipeline
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MPLCONFIGDIR=/tmp/matplotlib \
    ELEVATION_CACHE_DIR=/tmp/igs-elevation-cache \
    SPECIES_CACHE_DIR=/tmp/igs-species-cache
WORKDIR /app/pipeline
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        gdal-bin \
        libgdal-dev \
        libgeos-dev \
        libproj-dev \
    && rm -rf /var/lib/apt/lists/*
COPY pipeline/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY pipeline/ ./
CMD ["sh", "/app/pipeline/entrypoint.sh"]

# --- Client build ---
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM nginx:alpine AS client
COPY --from=client-build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

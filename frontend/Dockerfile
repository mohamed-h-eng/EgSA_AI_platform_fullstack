# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────
FROM node:22-alpine AS build

# Optional extra CA certificate(s) for networks/antivirus doing TLS inspection.
# Put *.crt files in frontend/certs/ (the folder may contain only its README).
# Node reads them via NODE_EXTRA_CA_CERTS (no apk needed, which would itself fail behind TLS inspection).
COPY certs/ /tmp/certs/
RUN cat /tmp/certs/*.crt > /etc/extra-ca.pem 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/etc/extra-ca.pem

RUN npm install -g pnpm@10
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm build

# ── Runtime stage: static files served by nginx ──────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# The site config (SPA + /api proxy) is mounted from ../nginx/nginx.conf by docker-compose.
EXPOSE 80

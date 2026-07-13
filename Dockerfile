# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# --include=dev forces devDependencies (tsc, vite, etc.) even if the
# environment has NODE_ENV=production or a .npmrc with production=true.
RUN npm ci --include=dev

COPY . .
RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

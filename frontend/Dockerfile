# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm install --silent

# Copy sources and build
COPY . .
RUN npm run build -- --configuration production

# ── Runtime stage (Nginx) ─────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist/safecity-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

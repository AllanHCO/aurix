# Aurix: backend + frontend no mesmo app (Fly.io, região São Paulo)
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Em produção o front chama /api no mesmo host
ENV VITE_API_URL=
RUN npm run build

# Backend em Debian (slim): Prisma precisa de glibc/OpenSSL que Alpine não tem
FROM node:20-slim AS backend
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npx prisma generate && npm run build
COPY --from=frontend /app/frontend/dist ./dist/public

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]

# API-only: não copia o frontend. Para app completo, use o Dockerfile na RAIZ do repo + fly deploy na raiz.
# Backend Aurix - para deploy no Fly.io (região São Paulo)
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3001
CMD ["node", "dist/server.js"]

# Backend Aurix - para deploy no Fly.io (região São Paulo)
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3001
CMD ["node", "dist/server.js"]

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production --frozen-lockfile
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/migration ./dist/migration/

EXPOSE 3001
CMD ["node", "dist/index.js"]

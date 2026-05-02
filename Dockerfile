# ---- Stage 1: Build frontend ----
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Stage 2: Build backend ----
FROM node:20-alpine AS backend-builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- Stage 3: Production image ----
FROM node:20-alpine AS production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

COPY backend/package*.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++

COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /frontend/dist ./public

RUN mkdir -p /app/data && chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/data/visits.db
ENV VISITS_PER_TREE=10

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD node -e "require('http').get('http://localhost:8080/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.js"]

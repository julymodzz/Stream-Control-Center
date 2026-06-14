# Multi-Stage Build – Stream Control Center v2.0 (Security-Hardened)

FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --ignore-scripts
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --ignore-scripts
COPY backend/ ./
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app

RUN apk add --no-cache iputils procps wget \
    && addgroup -g 1001 scc \
    && adduser -u 1001 -G scc -D -H scc

COPY backend/package.json ./backend/
RUN cd backend && npm install --omit=dev --ignore-scripts

COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/data && chown -R scc:scc /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV PROC_PATH=/proc
ENV DATA_DIR=/app/data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

USER scc
WORKDIR /app/backend
CMD ["node", "dist/index.js"]

FROM node:22-alpine AS development
WORKDIR /app
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN cd backend && npm install && cd ../frontend && npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev", "--prefix", "backend"]

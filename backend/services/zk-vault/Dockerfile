# MediLedger Nigeria — ZK Vault Service
# NestJS + snarkjs — CPU-intensive Groth16 proof generation
# Proof generation: ~800ms on 2 cores; verification: ~5ms

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

# snarkjs requires the wasm files at runtime — these come from the circuits setup
# Mount the circuits/build and circuits/keys dirs via Docker volume (see docker-compose)
RUN apk add --no-cache tini

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3012

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3012/api/v1/zk/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]

# Multi-stage build for Event Handler

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy workspace root package files
COPY package.json package-lock.json ./

# Copy all workspace packages
COPY packages ./packages

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Build the common package first
RUN npm run build --workspace=@axiom/common

# Build the event-handler package
RUN npm run build --workspace=@axiom/event-handler

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    sqlite \
    git \
    bash

# Create non-root user
RUN addgroup -g 1001 axiom && \
    adduser -D -u 1001 -G axiom axiom

# Set working directory
WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder --chown=axiom:axiom /workspace/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=axiom:axiom /workspace/packages/common/package.json ./packages/common/
COPY --from=builder --chown=axiom:axiom /workspace/packages/event-handler/dist ./packages/event-handler/dist
COPY --from=builder --chown=axiom:axiom /workspace/packages/event-handler/package.json ./packages/event-handler/
COPY --from=builder --chown=axiom:axiom /workspace/packages/event-handler/prompts ./packages/event-handler/prompts
COPY --from=builder --chown=axiom:axiom /workspace/packages/event-handler/actions ./packages/event-handler/actions
COPY --from=builder --chown=axiom:axiom /workspace/packages/event-handler/schemas ./packages/event-handler/schemas
COPY --from=builder --chown=axiom:axiom /workspace/node_modules ./node_modules
COPY --from=builder --chown=axiom:axiom /workspace/package.json ./

# Create data directories
RUN mkdir -p /data/state /data/logs /data/events /data/work && \
    chown -R axiom:axiom /data

# Switch to non-root user
USER axiom

# Set environment
ENV NODE_ENV=production

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Run the event handler
CMD ["node", "packages/event-handler/dist/index.js", "--config=/app/config.yaml"]

# Multi-stage build for Apicurio Axiom
# Optimized for development and production use

# Build arguments
ARG VERSION=latest

# Stage 1: Builder - Build TypeScript and install dependencies
FROM node:20-alpine AS builder

# Install build dependencies for native modules (better-sqlite3, node-pty)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash

WORKDIR /build

# Copy package files first for better layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY prompts/ ./prompts/
COPY actions/ ./actions/
COPY schemas/ ./schemas/

# Build TypeScript to JavaScript
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Stage 2: Production - Minimal runtime image
FROM node:20-alpine

# Re-declare ARG for this stage
ARG VERSION=latest

# Install runtime dependencies
RUN apk add --no-cache \
    bash \
    git \
    ca-certificates \
    tini \
    sqlite

# Create non-root user with specific UID/GID for consistent file permissions
RUN addgroup -g 1001 axiom && \
    adduser -D -u 1001 -G axiom axiom

# Create application and data directories
RUN mkdir -p /app /data /config && \
    chown -R axiom:axiom /app /data /config

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=axiom:axiom /build/node_modules ./node_modules
COPY --from=builder --chown=axiom:axiom /build/dist ./dist
COPY --from=builder --chown=axiom:axiom /build/package*.json ./

# Copy prompts, actions, and schemas (needed at runtime)
# Note: prompts will be overridden by volume mount in docker-compose
COPY --chown=axiom:axiom prompts/ ./prompts/
COPY --chown=axiom:axiom actions/ ./actions/
COPY --chown=axiom:axiom schemas/ ./schemas/

# Copy and setup entrypoint script
COPY --chmod=755 docker/build/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER axiom

# Expose port for health checks (if we add HTTP health endpoint later)
# EXPOSE 3000

# Declare required volume mount points (documentation and validation)
# These volumes MUST be provided when running the container
VOLUME ["/app/config.yaml"]

# Declare recommended volume mount point for all data
VOLUME ["/app/data"]

# Health check - verify Node.js process is running
# We can enhance this later with an actual health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Use tini as init system for proper signal handling (graceful shutdown)
# Then run our entrypoint script which validates required mounts
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

# Start application (passed to entrypoint script)
CMD ["node", "dist/index.js"]

# Metadata labels
LABEL org.opencontainers.image.title="Apicurio Axiom"
LABEL org.opencontainers.image.description="GitHub Automation Service with AI Agent Integration"
LABEL org.opencontainers.image.vendor="Apicurio Community"
LABEL org.opencontainers.image.source="https://github.com/Apicurio/apicurio-axiom"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.version="${VERSION}"

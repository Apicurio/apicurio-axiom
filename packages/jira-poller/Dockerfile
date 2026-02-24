# Multi-stage build for Jira Poller

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

# Build the jira-poller package
RUN npm run build --workspace=@axiom/jira-poller

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    sqlite

# Create non-root user
RUN addgroup -g 1001 axiom && \
    adduser -D -u 1001 -G axiom axiom

# Set working directory
WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder --chown=axiom:axiom /workspace/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=axiom:axiom /workspace/packages/common/package.json ./packages/common/
COPY --from=builder --chown=axiom:axiom /workspace/packages/jira-poller/dist ./packages/jira-poller/dist
COPY --from=builder --chown=axiom:axiom /workspace/packages/jira-poller/package.json ./packages/jira-poller/
COPY --from=builder --chown=axiom:axiom /workspace/node_modules ./node_modules
COPY --from=builder --chown=axiom:axiom /workspace/package.json ./

# Create data directories
RUN mkdir -p /data/state /data/events && \
    chown -R axiom:axiom /data

# Switch to non-root user
USER axiom

# Set environment
ENV NODE_ENV=production

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Run the poller
CMD ["node", "packages/jira-poller/dist/index.js", "--config=/app/config.yaml"]

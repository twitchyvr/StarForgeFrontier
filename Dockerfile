# Multi-stage Docker build for StarForgeFrontier
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for SQLite and native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S starforge -u 1001

# Copy application code
COPY --chown=starforge:nodejs . .

# Create directories for database and logs
RUN mkdir -p /app/data /app/logs && \
    chown -R starforge:nodejs /app/data /app/logs

# Switch to non-root user
USER starforge

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Expose port
EXPOSE 3000

# Start the enhanced server
CMD ["node", "server-enhanced.js"]
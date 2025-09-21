########################################
# Build stage: install all deps & compile
########################################
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json ./
COPY tsconfig.json ./

# Force-install ALL dependencies (including dev) for building, regardless of upstream env
ENV NPM_CONFIG_PRODUCTION=false
ENV NODE_ENV=development
RUN npm ci

# Copy source and build
COPY src/ ./src/
# Ensure local node binaries (like tsc) are on PATH and verify TypeScript
ENV PATH=/app/node_modules/.bin:$PATH
RUN npx tsc --version && npm run build

########################################
# Runtime stage: production-only deps
########################################
FROM node:18-alpine AS runtime

WORKDIR /app

# Install curl for HEALTHCHECK
RUN apk add --no-cache curl

# Copy package files and install only production deps
COPY package*.json ./
ENV NODE_ENV=production
RUN npm ci --only=production

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# Create non-root user and necessary directories
RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 \
  && mkdir -p /app/logs /app/uploads \
  && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["npm", "start"]
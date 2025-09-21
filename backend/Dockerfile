########################################
# Stage 1: Build (install dev deps + compile TS)
########################################
FROM node:18-alpine AS build

WORKDIR /app

# Ensure consistent, clean installs
ENV CI=true \
    NODE_ENV=development \
    NPM_CONFIG_LOGLEVEL=warn

# Copy manifest files first to maximize layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including dev) for building
RUN npm ci

# Copy source and build
COPY src/ ./src/

# Ensure local node binaries (like tsc) are on PATH and compile
ENV PATH=/app/node_modules/.bin:$PATH
RUN node -v && npm -v && tsc -v || ./node_modules/.bin/tsc -v
RUN npm run build

########################################
# Stage 2: Runtime (production only + compiled output)
########################################
FROM node:18-alpine AS runtime

WORKDIR /app

# Keep runtime small and secure
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled dist from build stage
COPY --from=build /app/dist ./dist

# Non-root user and basic directories
RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 \
  && mkdir -p /app/logs /app/uploads \
  && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

# Health check on the server
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:5000/health || exit 1

# Start the compiled server
CMD ["npm", "start"]
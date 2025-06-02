# syntax=docker/dockerfile:1

# Builder stage
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
# Install dependencies
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
# Copy source files
COPY . .
# Build the project and copy required assets into dist
RUN npm run build \
    && mkdir -p dist/database \
    && cp src/database/schema.sql dist/database/schema.sql \
    && cp -r src/database/migrations dist/database/migrations

# Production stage
FROM node:18-alpine AS production
WORKDIR /usr/src/app
# Only install production dependencies
COPY --from=builder /usr/src/app/package.json /usr/src/app/package-lock.json ./
RUN npm ci --omit=dev
# Copy compiled code
COPY --from=builder /usr/src/app/dist ./dist
# Copy swagger.json for API docs
COPY --from=builder /usr/src/app/swagger.json ./swagger.json
# Default environment
ENV NODE_ENV=production
EXPOSE 3000
# Start the server
CMD ["node", "dist/server.js"] 
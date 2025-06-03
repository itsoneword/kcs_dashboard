# syntax=docker/dockerfile:1

# Builder stage
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
# Build the SvelteKit application
RUN npm run build

# Production stage: serve static files
FROM node:18-alpine AS production
WORKDIR /usr/src/app
# Install a lightweight static server
RUN npm install -g serve
# Copy the static build output
COPY --from=builder /usr/src/app/build ./build
# Expose port for static server
EXPOSE 4173
# Serve the build folder
CMD ["serve", "-s", "build", "-l", "5173"] 
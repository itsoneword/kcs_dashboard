#!/usr/bin/env bash
set -e

# Ensure root .env exists
if [ ! -f .env ]; then
  echo "Creating root .env from backend/env.example"
  cp backend/env.example .env
  echo "" >> .env
  echo "HOST=0.0.0.0" >> .env
  echo "BACKEND_PORT=3000" >> .env
  echo "FRONTEND_PORT=5173" >> .env
  echo "FRONTEND_URL=http://localhost:\\${FRONTEND_PORT}" >> .env
  echo "Please review root .env before continuing."
fi

# Build and start services using root .env
docker-compose --env-file .env up -d --build

# Show status
docker-compose --env-file .env ps 
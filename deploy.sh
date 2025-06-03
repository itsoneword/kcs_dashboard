#!/usr/bin/env bash
set -e

# Ensure .env exists for backend
if [ ! -f backend/.env ]; then
  echo "Creating backend .env from example"
  cp backend/env.example backend/.env
  echo "Please review and update backend/.env before continuing."
fi

# Build and start services
docker-compose up -d --build

# Show status
docker-compose ps 
#!/usr/bin/env bash
set -e

# Ensure .env exists for backend
if [ ! -f kcs-portal/backend/.env ]; then
  echo "Creating backend .env from example"
  cp kcs-portal/backend/env.example kcs-portal/backend/.env
  echo "Please review and update kcs-portal/backend/.env before continuing."
fi

# Build and start services
docker-compose up -d --build

# Show status
docker-compose ps 
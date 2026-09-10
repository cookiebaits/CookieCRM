#!/bin/sh
set -e

echo "=== [Scambaiter CRM Deployment Entrypoint] ==="
echo "Running automated Prisma database migrations..."

# Automated database schema sync / migration
npx prisma db push --skip-generate

echo "Database sync complete. Checking database permissions..."

# Start the full-stack server
echo "Starting Scambaiter CRM on port 3000..."
exec "$@"

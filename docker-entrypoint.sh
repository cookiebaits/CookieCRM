#!/bin/sh
set -e

echo "=== [Scambaiter CRM Deployment Entrypoint] ==="
echo "Configuring persistent SQLite database and environment..."

# Execute database preflight to sanitize DB/DATABASE_URL and set folder permissions
if [ -f "./scripts/prepare-db.js" ]; then
  node ./scripts/prepare-db.js
fi

# Source validated environment variables into shell
if [ -f "./.env.db" ]; then
  . ./.env.db
fi

echo "Running automated Prisma database synchronization..."
# Automated database schema sync / push
npx prisma db push --skip-generate --accept-data-loss || {
  echo "[WARNING] Non-fatal warning during prisma db push. Continuing server startup..."
}

echo "Database initialization complete."
echo "Starting Scambaiter CRM on port ${PORT:-3000} behind Traefik / Cloudflare..."
exec "$@"

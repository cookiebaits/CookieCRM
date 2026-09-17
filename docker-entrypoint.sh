#!/bin/sh
set -e

echo "=== [Scambaiter CRM Deployment Entrypoint] ==="
echo "Ensuring persistent storage directory exists..."
mkdir -p /app/data
chmod 777 /app/data 2>/dev/null || true

if [ -n "$DATABASE_URL" ] || [ -n "$DIRECT_URL" ]; then
  echo "Supabase Direct PostgreSQL connection detected."
elif [ -n "$DB" ] || [ -n "$SUPABASE_URL" ]; then
  echo "Supabase Database: ${DB:-$SUPABASE_URL}..."
fi

echo "Starting Scambaiter CRM on port ${PORT:-3000} behind Traefik / Cloudflare..."
exec "$@"

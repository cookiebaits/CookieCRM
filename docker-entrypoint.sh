#!/bin/sh
set -e

echo "=== [Scambaiter CRM Deployment Entrypoint] ==="
echo "Ensuring persistent storage directory exists..."

# Create persistent storage folder in mounted volume
mkdir -p /app/data
chmod 777 /app/data 2>/dev/null || true

# Test persistent write capability
touch /app/data/.storage_check 2>/dev/null && rm -f /app/data/.storage_check || echo "[WARN] Volume permissions restricted on /app/data"

if [ -n "$DATABASE_URL" ] || [ -n "$DIRECT_URL" ]; then
  echo "Supabase PostgreSQL connection string detected."
elif [ -n "$SUPABASE_URL" ]; then
  echo "Supabase project URL detected: ${SUPABASE_URL}"
else
  echo "[NOTICE] Operating in local file mode (/app/data/scambaiter_db.json)."
fi

echo "Starting Scambaiter CRM on port ${PORT:-3000}..."
exec "$@"

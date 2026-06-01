#!/usr/bin/env bash
set -euo pipefail

# Run database migrations against Azure PostgreSQL
# Usage: ./run-migrations.sh <pg-host> <pg-database> <pg-user>
# Password should be in PGPASSWORD environment variable

PG_HOST="${1:?Usage: run-migrations.sh <host> <database> <user>}"
PG_DB="${2:?Usage: run-migrations.sh <host> <database> <user>}"
PG_USER="${3:?Usage: run-migrations.sh <host> <database> <user>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../../database/migrations"

echo "Running migrations against $PG_HOST/$PG_DB as $PG_USER"

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "  Applying $(basename "$f")..."
  psql "host=$PG_HOST dbname=$PG_DB user=$PG_USER sslmode=require" -f "$f"
done

echo "All migrations applied."

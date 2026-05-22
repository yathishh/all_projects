#!/bin/bash
# =============================================================
# Script: add_new_database.sh
# Purpose: Create new DB + auto-grant global_rw role on it
# Usage: ./add_new_database.sh <new_database_name>
# Example: ./add_new_database.sh analytics_db
# =============================================================

DB_HOST="172.30.19.51"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

# ---------- Input validation ----------
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <new_database_name>"
  echo "Example: $0 analytics_db"
  exit 1
fi

NEW_DB="$1"

echo "======================================================"
echo " Setting up new database : $NEW_DB"
echo "======================================================"

# Step 1: Check if DB already exists
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_database WHERE datname = '$NEW_DB';")

if [ "$DB_EXISTS" = "1" ]; then
  echo "ERROR: Database '$NEW_DB' already exists!"
  exit 1
fi

# Step 2: Create the new database
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
  "CREATE DATABASE \"$NEW_DB\";"
echo "✔ Database '$NEW_DB' created."

# Step 3: Revoke PUBLIC connect (security best practice)
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
  "REVOKE CONNECT ON DATABASE \"$NEW_DB\" FROM PUBLIC;"
echo "✔ PUBLIC connect revoked."

# Step 4: Grant CONNECT on new DB to global_rw
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
  "GRANT CONNECT ON DATABASE \"$NEW_DB\" TO $ROLE_NAME;"
echo "✔ CONNECT granted to '$ROLE_NAME'."

# Step 5: Get all schemas in new DB and grant permissions
SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" -Atc "
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND schema_name NOT LIKE 'pg_%'
  ORDER BY schema_name;
")

if [ -z "$SCHEMAS" ]; then
  # No schemas yet — still set default privileges for future schemas
  echo "  No schemas yet — setting default privileges for future objects..."
  SCHEMAS="public"
fi

for SCHEMA in $SCHEMAS; do
  echo "  -> Granting on schema: $SCHEMA"

  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" <<EOF

-- Schema usage
GRANT USAGE ON SCHEMA "$SCHEMA" TO $ROLE_NAME;

-- Existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "$SCHEMA" TO $ROLE_NAME;

-- Existing sequences
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA "$SCHEMA" TO $ROLE_NAME;

-- Existing functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "$SCHEMA" TO $ROLE_NAME;

-- Future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA "$SCHEMA"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $ROLE_NAME;

-- Future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA "$SCHEMA"
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $ROLE_NAME;

-- Future functions
ALTER DEFAULT PRIVILEGES IN SCHEMA "$SCHEMA"
  GRANT EXECUTE ON FUNCTIONS TO $ROLE_NAME;
EOF

  echo "  ✔ Done: $NEW_DB -> $SCHEMA"
done

echo ""
echo "======================================================"
echo " ✔ New database '$NEW_DB' setup COMPLETE!"
echo "   -> global_rw has full RW on all schemas"
echo "   -> PUBLIC connect is blocked"
echo "======================================================"

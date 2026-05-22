#!/bin/bash
# =============================================================
# Script: setup_global_rw.sh
# Purpose: Grant rw permissions to global_rw role across ALL
#          databases and schemas in the cluster
# Usage: ./setup_global_rw.sh
# =============================================================

DB_HOST="172.30.19.51"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

echo "======================================================"
echo " Setting up role: $ROLE_NAME across all databases"
echo "======================================================"

# Step 1: Get all databases (exclude system DBs)
DATABASES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT datname FROM pg_database
  WHERE datistemplate = false
  AND datname NOT IN ('postgres', 'rdsadmin')
  ORDER BY datname;
")

if [ -z "$DATABASES" ]; then
  echo "ERROR: No databases found!"
  exit 1
fi

echo "Found databases: $DATABASES"
echo ""

# Step 2: Loop through each database
for DB in $DATABASES; do
  echo "------------------------------------------------------"
  echo " Processing database: $DB"
  echo "------------------------------------------------------"

  # Grant CONNECT on the database
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
    "GRANT CONNECT ON DATABASE \"$DB\" TO $ROLE_NAME;"

  # Get all non-system schemas in this database
  SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc "
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND schema_name NOT LIKE 'pg_%'
    ORDER BY schema_name;
  ")

  if [ -z "$SCHEMAS" ]; then
    echo "  No schemas found in $DB, skipping..."
    continue
  fi

  echo "  Schemas found: $SCHEMAS"

  for SCHEMA in $SCHEMAS; do
    echo "  -> Granting on schema: $SCHEMA"

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" <<EOF
-- Schema usage
GRANT USAGE ON SCHEMA "$SCHEMA" TO $ROLE_NAME;

-- Existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "$SCHEMA" TO $ROLE_NAME;

-- Existing sequences
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA "$SCHEMA" TO $ROLE_NAME;

-- Existing functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "$SCHEMA" TO $ROLE_NAME;

-- Future tables (default privileges)
ALTER DEFAULT PRIVILEGES IN SCHEMA "$SCHEMA"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $ROLE_NAME;

-- Future sequences (default privileges)
ALTER DEFAULT PRIVILEGES IN SCHEMA "$SCHEMA"
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $ROLE_NAME;

-- Future functions (default privileges)
ALTER DEFAULT PRIVILEGES IN SCHEMA "$SCHEMA"
  GRANT EXECUTE ON FUNCTIONS TO $ROLE_NAME;
EOF

    echo "  ✔ Done: $DB -> $SCHEMA"
  done

  echo " ✔ Completed database: $DB"
  echo ""
done

echo "======================================================"
echo " global_rw role setup COMPLETE across all databases!"
echo "======================================================"

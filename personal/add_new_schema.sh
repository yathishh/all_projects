#!/bin/bash
# =============================================================
# Script: add_new_schema.sh
# Purpose: Create new schema + auto-grant global_rw on it
# Usage: ./add_new_schema.sh <database> <schema_name>
# Example: ./add_new_schema.sh analytics_db reports
# =============================================================

DB_HOST="172.30.19.51"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <database> <schema_name>"
  exit 1
fi

TARGET_DB="$1"
NEW_SCHEMA="$2"

echo "Creating schema '$NEW_SCHEMA' in '$TARGET_DB'..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" <<EOF

-- Create schema
CREATE SCHEMA IF NOT EXISTS "$NEW_SCHEMA";

-- Grant to global_rw
GRANT USAGE ON SCHEMA "$NEW_SCHEMA" TO $ROLE_NAME;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "$NEW_SCHEMA" TO $ROLE_NAME;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA "$NEW_SCHEMA" TO $ROLE_NAME;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "$NEW_SCHEMA" TO $ROLE_NAME;

-- Future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA "$NEW_SCHEMA"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $ROLE_NAME;
ALTER DEFAULT PRIVILEGES IN SCHEMA "$NEW_SCHEMA"
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $ROLE_NAME;
ALTER DEFAULT PRIVILEGES IN SCHEMA "$NEW_SCHEMA"
  GRANT EXECUTE ON FUNCTIONS TO $ROLE_NAME;

EOF

echo "✔ Schema '$NEW_SCHEMA' created and granted to '$ROLE_NAME'!"

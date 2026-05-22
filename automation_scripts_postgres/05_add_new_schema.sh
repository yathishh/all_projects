#!/bin/bash
# =============================================================
# Script  : 05_add_new_schema.sh
# Purpose : Create new schema inside a DB + grant global_rw
# Usage   : ./05_add_new_schema.sh <database> <schema_name>
# Example : ./05_add_new_schema.sh analytics_db reports
# =============================================================

source "$(dirname "$0")/pg_config.sh"

if [ "$#" -ne 2 ]; then
  echo "Usage  : $0 <database> <schema_name>"
  echo "Example: $0 analytics_db reports"
  exit 1
fi

TARGET_DB="$1"
NEW_SCHEMA="$2"

echo "======================================================"
echo " [05] Add New Schema"
echo " Database : $TARGET_DB"
echo " Schema   : $NEW_SCHEMA"
echo "======================================================"

# ---------- Step 1: Check DB exists ----------
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB';")

if [ "$DB_EXISTS" != "1" ]; then
  echo "ERROR: Database '$TARGET_DB' does not exist!"
  exit 1
fi

# ---------- Step 2: Check schema already exists ----------
SCHEMA_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" -Atc \
  "SELECT 1 FROM information_schema.schemata WHERE schema_name = '$NEW_SCHEMA';")

if [ "$SCHEMA_EXISTS" = "1" ]; then
  echo "WARNING: Schema '$NEW_SCHEMA' already exists. Re-applying grants..."
else
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" \
    -c "CREATE SCHEMA \"$NEW_SCHEMA\";" > /dev/null
  echo "✔ Schema '$NEW_SCHEMA' created."
fi

# ---------- Step 3: Apply all grants ----------
echo "-> Applying grants on schema: $NEW_SCHEMA"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" \
  -c "GRANT USAGE ON SCHEMA \"$NEW_SCHEMA\" TO $ROLE_NAME;" > /dev/null
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" \
  -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA \"$NEW_SCHEMA\" TO $ROLE_NAME;" > /dev/null
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" \
  -c "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA \"$NEW_SCHEMA\" TO $ROLE_NAME;" > /dev/null
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" \
  -c "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA \"$NEW_SCHEMA\" TO $ROLE_NAME;" > /dev/null
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$NEW_SCHEMA\" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $ROLE_NAME;" > /dev/null
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$NEW_SCHEMA\" GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $ROLE_NAME;" > /dev/null
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$NEW_SCHEMA\" GRANT EXECUTE ON FUNCTIONS TO $ROLE_NAME;" > /dev/null

# ---------- Step 4: Verify ----------
RESULT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" -Atc \
  "SELECT has_schema_privilege('$ROLE_NAME', '$NEW_SCHEMA', 'USAGE');")

if [ "$RESULT" = "t" ]; then
  echo ""
  echo "======================================================"
  echo " ✔ Schema '$NEW_SCHEMA' in '$TARGET_DB' is ready!"
  echo "======================================================"
else
  echo ""
  echo "======================================================"
  echo " ❌ ERROR: Grant verification failed for '$NEW_SCHEMA'!"
  echo "======================================================"
  exit 1
fi

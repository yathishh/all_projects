#!/bin/bash
# =============================================================
# Script  : 03_add_new_database.sh
# Purpose : Create new DB + auto-grant global_rw on all schemas
# Usage   : ./03_add_new_database.sh <database_name>
# Example : ./03_add_new_database.sh analytics_db
# =============================================================

source "$(dirname "$0")/pg_config.sh"

if [ "$#" -ne 1 ]; then
  echo "Usage  : $0 <database_name>"
  echo "Example: $0 analytics_db"
  exit 1
fi

NEW_DB="$1"

echo "======================================================"
echo " [03] Add New Database"
echo " Database : $NEW_DB"
echo "======================================================"

# ---------- Step 1: Check DB not already exists ----------
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_database WHERE datname = '$NEW_DB';")

if [ "$DB_EXISTS" = "1" ]; then
  echo "ERROR: Database '$NEW_DB' already exists!"
  exit 1
fi

# ---------- Step 2: Create database ----------
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
  -c "CREATE DATABASE \"$NEW_DB\";" > /dev/null
echo "✔ Database '$NEW_DB' created."

# ---------- Step 3: Revoke PUBLIC connect ----------
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
  -c "REVOKE CONNECT ON DATABASE \"$NEW_DB\" FROM PUBLIC;" > /dev/null
echo "✔ PUBLIC connect revoked."

# ---------- Step 4: Grant schemas (default: public) ----------
SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" -Atc "
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
  AND schema_name NOT LIKE 'pg_%'
  ORDER BY schema_name;")

[ -z "$SCHEMAS" ] && SCHEMAS="public"

for SCHEMA in $SCHEMAS; do
  echo "-> Granting on schema: $SCHEMA"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" \
    -c "GRANT USAGE ON SCHEMA \"$SCHEMA\" TO $ROLE_NAME;" > /dev/null
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" \
    -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA \"$SCHEMA\" TO $ROLE_NAME;" > /dev/null
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" \
    -c "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA \"$SCHEMA\" TO $ROLE_NAME;" > /dev/null
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" \
    -c "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA \"$SCHEMA\" TO $ROLE_NAME;" > /dev/null
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" \
    -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $ROLE_NAME;" > /dev/null
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" \
    -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $ROLE_NAME;" > /dev/null
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" \
    -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" GRANT EXECUTE ON FUNCTIONS TO $ROLE_NAME;" > /dev/null

  VERIFY=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$NEW_DB" -Atc \
    "SELECT has_schema_privilege('$ROLE_NAME', '$SCHEMA', 'USAGE');")
  [ "$VERIFY" = "t" ] && echo "  ✔ Done: $SCHEMA" || echo "  ❌ FAILED: $SCHEMA"
done

echo ""
echo "======================================================"
echo " ✔ Database '$NEW_DB' is ready!"
echo "   global_rw has RW on all schemas"
echo "   To add a user: ./02_create_app_user.sh <user> <pass> $NEW_DB"
echo "======================================================"

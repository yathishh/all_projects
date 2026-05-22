#!/bin/bash
# =============================================================
# Script  : 02_create_app_user.sh
# Purpose : Create a new app user with access to specific DB only
# Usage   : ./02_create_app_user.sh <username> <password> <database>
# Example : ./02_create_app_user.sh app_sales 'Secret@123' sales_db
# PG16    : Uses INHERIT=true + GRANT WITH INHERIT TRUE
# =============================================================

source "$(dirname "$0")/pg_config.sh"

# ---------- Input validation ----------
if [ "$#" -ne 3 ]; then
  echo "Usage  : $0 <username> <password> <database>"
  echo "Example: $0 app_sales 'Secret@123' sales_db"
  exit 1
fi

APP_USER="$1"
APP_PASS="$2"
TARGET_DB="$3"

echo "======================================================"
echo " [02] Create App User"
echo " User     : $APP_USER"
echo " Target DB: $TARGET_DB"
echo "======================================================"

# ---------- Step 1: Verify target DB exists ----------
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB';")

if [ "$DB_EXISTS" != "1" ]; then
  echo "ERROR: Database '$TARGET_DB' does not exist!"
  echo "Tip  : Create it first using ./03_add_new_database.sh $TARGET_DB"
  exit 1
fi

# ---------- Step 2: Check if user already exists ----------
USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER';")

if [ "$USER_EXISTS" = "1" ]; then
  echo "WARNING: User '$APP_USER' already exists."
  echo "Tip    : To add more DBs use ./04_grant_user_databases.sh"
  exit 1
fi

# ---------- Step 3: Create user with INHERIT=true (PG16) ----------
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c "
  CREATE USER \"$APP_USER\" WITH
    LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
    INHERIT NOREPLICATION NOBYPASSRLS
    CONNECTION LIMIT 50
    PASSWORD '$APP_PASS';" > /dev/null
echo "✔ User '$APP_USER' created with INHERIT=true."

# ---------- Step 4: Grant role WITH INHERIT TRUE (PG16 fix) ----------
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
  -c "GRANT $ROLE_NAME TO \"$APP_USER\" WITH INHERIT TRUE;" > /dev/null
echo "✔ Role '$ROLE_NAME' granted WITH INHERIT TRUE."

# ---------- Step 5: Grant CONNECT on target DB only ----------
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
  -c "GRANT CONNECT ON DATABASE \"$TARGET_DB\" TO \"$APP_USER\";" > /dev/null
echo "✔ CONNECT granted on '$TARGET_DB' only."

# ---------- Step 6: Revoke PUBLIC connect on target DB ----------
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
  -c "REVOKE CONNECT ON DATABASE \"$TARGET_DB\" FROM PUBLIC;" > /dev/null
echo "✔ PUBLIC connect revoked on '$TARGET_DB'."

# ---------- Step 7: Verify ----------
ROLINHERIT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT rolinherit FROM pg_roles WHERE rolname = '$APP_USER';")

INHERIT_OPT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT m.inherit_option FROM pg_auth_members m
  JOIN pg_roles r ON r.oid = m.roleid
  JOIN pg_roles u ON u.oid = m.member
  WHERE r.rolname = '$ROLE_NAME' AND u.rolname = '$APP_USER';")

DB_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT count(*) FROM pg_database
  WHERE has_database_privilege('$APP_USER', datname, 'CONNECT')
  AND datistemplate = false
  AND datname != 'postgres';")

SCHEMA_ACCESS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" -Atc "
  SELECT string_agg(schema_name, ', ' ORDER BY schema_name)
  FROM information_schema.schemata
  WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
  AND schema_name NOT LIKE 'pg_%'
  AND has_schema_privilege('$APP_USER', schema_name, 'USAGE');")

echo ""
echo "======================================================"
echo " Verification"
echo "======================================================"
echo "  rolinherit        : $ROLINHERIT  $([ "$ROLINHERIT" = "t" ] && echo "✅" || echo "❌")"
echo "  inherit_option    : $INHERIT_OPT  $([ "$INHERIT_OPT" = "t" ] && echo "✅" || echo "❌")"
echo "  Databases visible : $DB_COUNT     $([ "$DB_COUNT" = "1" ] && echo "✅ (only $TARGET_DB)" || echo "❌ (should be 1)")"
echo "  Schema access     : ${SCHEMA_ACCESS:-none}  $([ -n "$SCHEMA_ACCESS" ] && echo "✅" || echo "❌")"

if [ "$ROLINHERIT" = "t" ] && [ "$INHERIT_OPT" = "t" ] && [ "$DB_COUNT" = "1" ]; then
  echo ""
  echo " ✅ User '$APP_USER' is ready!"
  echo "    Connect to : $TARGET_DB ONLY"
  echo "    Schemas    : ${SCHEMA_ACCESS:-none}"
else
  echo ""
  echo " ❌ Verification failed! Run: ./07_verify_user.sh $APP_USER"
  exit 1
fi
echo "======================================================"

#!/bin/bash
# =============================================================
# Script  : 07_verify_user.sh
# Purpose : Full permission report for a given user
# Usage   : ./07_verify_user.sh <username>
# Example : ./07_verify_user.sh app_sales
# =============================================================

source "$(dirname "$0")/pg_config.sh"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <username>"
  exit 1
fi

APP_USER="$1"

echo "======================================================"
echo " [07] Permission Report: $APP_USER"
echo "======================================================"

USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER';")

if [ "$USER_EXISTS" != "1" ]; then
  echo "ERROR: User '$APP_USER' does not exist!"; exit 1
fi

# User attributes
echo ""
echo "[ User Attributes ]"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -c "
  SELECT rolname, rolinherit, rolcanlogin, rolconnlimit
  FROM pg_roles WHERE rolname = '$APP_USER';"

# Role membership + inherit_option (PG16)
echo "[ Role Membership (PG16 inherit_option) ]"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -c "
  SELECT r.rolname AS role, m.inherit_option, m.admin_option
  FROM pg_auth_members m
  JOIN pg_roles r ON r.oid = m.roleid
  JOIN pg_roles u ON u.oid = m.member
  WHERE u.rolname = '$APP_USER';"

# Database access
echo "[ Database Access ]"
DB_LIST=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT datname FROM pg_database
  WHERE has_database_privilege('$APP_USER', datname, 'CONNECT')
  AND datistemplate = false
  AND datname != 'postgres'
  ORDER BY datname;")

DB_COUNT=0
for DB in $DB_LIST; do
  echo "  ✅ $DB"
  DB_COUNT=$((DB_COUNT + 1))
done
echo "  Total: $DB_COUNT database(s)"

# Schema access per DB
echo ""
echo "[ Schema Access per Database ]"
for DB in $DB_LIST; do
  echo ""
  echo "  Database: $DB"
  SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc "
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
    AND schema_name NOT LIKE 'pg_%'
    ORDER BY schema_name;")
  for SCHEMA in $SCHEMAS; do
    HAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc \
      "SELECT has_schema_privilege('$APP_USER', '$SCHEMA', 'USAGE');")
    [ "$HAS" = "t" ] \
      && echo "    ✅ $SCHEMA" \
      || echo "    ❌ $SCHEMA (no access)"
  done
done

echo ""
echo "======================================================"
echo " End of report: $APP_USER"
echo "======================================================"

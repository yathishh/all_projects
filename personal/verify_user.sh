#!/bin/bash
# =============================================================
# Script: verify_user.sh
# Purpose: Check all permissions for a given user
# Usage:   ./verify_user.sh <username>
# Example: ./verify_user.sh app_sales
# =============================================================

DB_HOST="172.30.19.51"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <username>"
  exit 1
fi

APP_USER="$1"

echo "======================================================"
echo " Permission Report for: $APP_USER"
echo "======================================================"

# Check 1: User exists
USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER';")

if [ "$USER_EXISTS" != "1" ]; then
  echo "ERROR: User '$APP_USER' does not exist!"
  exit 1
fi

# Check 2: User attributes
echo ""
echo "[ User Attributes ]"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -c "
  SELECT rolname, rolinherit, rolcanlogin, rolconnlimit
  FROM pg_roles WHERE rolname = '$APP_USER';
"

# Check 3: Role membership + inherit_option (PG16)
echo "[ Role Membership ]"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -c "
  SELECT r.rolname AS role, m.inherit_option, m.admin_option
  FROM pg_auth_members m
  JOIN pg_roles r ON r.oid = m.roleid
  JOIN pg_roles u ON u.oid = m.member
  WHERE u.rolname = '$APP_USER';
"

# Check 4: DB access
echo "[ Database Access ]"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT datname FROM pg_database
  WHERE has_database_privilege('$APP_USER', datname, 'CONNECT')
  AND datistemplate = false
  ORDER BY datname;
" | while read -r DB; do
  echo "  ✅ $DB"
done

# Check 5: Schema access per DB
echo ""
echo "[ Schema Access per Database ]"
ACCESSIBLE_DBS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT datname FROM pg_database
  WHERE has_database_privilege('$APP_USER', datname, 'CONNECT')
  AND datistemplate = false
  AND datname != 'postgres'
  ORDER BY datname;
")

for DB in $ACCESSIBLE_DBS; do
  echo ""
  echo "  Database: $DB"
  SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc "
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
    AND schema_name NOT LIKE 'pg_%'
    ORDER BY schema_name;
  ")
  for SCHEMA in $SCHEMAS; do
    HAS_USAGE=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc \
      "SELECT has_schema_privilege('$APP_USER', '$SCHEMA', 'USAGE');")
    if [ "$HAS_USAGE" = "t" ]; then
      echo "    ✅ schema: $SCHEMA"
    else
      echo "    ❌ schema: $SCHEMA (no access)"
    fi
  done
done

echo ""
echo "======================================================"
echo " End of report for: $APP_USER"
echo "======================================================"

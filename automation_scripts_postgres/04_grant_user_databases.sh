#!/bin/bash
# =============================================================
# Script  : 04_grant_user_databases.sh
# Purpose : Grant existing user access to one or more databases
# Usage   : ./04_grant_user_databases.sh <username> <db1> <db2> ...
# Example : ./04_grant_user_databases.sh app_sales sales_db analytics_db
# =============================================================

source "$(dirname "$0")/pg_config.sh"

if [ "$#" -lt 2 ]; then
  echo "Usage  : $0 <username> <db1> <db2> ..."
  echo "Example: $0 app_sales sales_db analytics_db"
  exit 1
fi

APP_USER="$1"
shift
DATABASES=("$@")

echo "======================================================"
echo " [04] Grant User Databases"
echo " User     : $APP_USER"
echo " Databases: ${DATABASES[*]}"
echo "======================================================"

# ---------- Step 1: Check user exists ----------
USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER';")

if [ "$USER_EXISTS" != "1" ]; then
  echo "ERROR: User '$APP_USER' does not exist!"
  echo "Tip  : Create user first using ./02_create_app_user.sh"
  exit 1
fi

# ---------- Step 2: Check + fix inherit_option (PG16) ----------
INHERIT_OPT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT m.inherit_option FROM pg_auth_members m
  JOIN pg_roles r ON r.oid = m.roleid
  JOIN pg_roles u ON u.oid = m.member
  WHERE r.rolname = '$ROLE_NAME' AND u.rolname = '$APP_USER';")

if [ "$INHERIT_OPT" = "t" ]; then
  echo "✔ Role '$ROLE_NAME' already granted WITH INHERIT TRUE."
elif [ "$INHERIT_OPT" = "f" ]; then
  echo "-> Re-granting '$ROLE_NAME' WITH INHERIT TRUE (PG16 fix)..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "REVOKE $ROLE_NAME FROM \"$APP_USER\";" > /dev/null
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "GRANT $ROLE_NAME TO \"$APP_USER\" WITH INHERIT TRUE;" > /dev/null
  echo "✔ Role re-granted WITH INHERIT TRUE."
else
  echo "-> Granting '$ROLE_NAME' WITH INHERIT TRUE..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "GRANT $ROLE_NAME TO \"$APP_USER\" WITH INHERIT TRUE;" > /dev/null
  echo "✔ Role granted WITH INHERIT TRUE."
fi

echo ""

# ---------- Step 3: Grant CONNECT on each DB ----------
for DB in "${DATABASES[@]}"; do
  echo "------------------------------------------------------"
  echo " Processing: $DB"
  echo "------------------------------------------------------"

  DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB';")

  if [ "$DB_EXISTS" != "1" ]; then
    echo "  ⚠ Database '$DB' does not exist! Skipping..."
    continue
  fi

  CONNECT_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT has_database_privilege('$APP_USER', '$DB', 'CONNECT');")

  if [ "$CONNECT_EXISTS" = "t" ]; then
    echo "  ✔ CONNECT already granted on '$DB'. Skipping..."
    continue
  fi

  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "GRANT CONNECT ON DATABASE \"$DB\" TO \"$APP_USER\";" > /dev/null
  echo "  ✔ CONNECT granted on '$DB'"

  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "REVOKE CONNECT ON DATABASE \"$DB\" FROM PUBLIC;" > /dev/null
  echo "  ✔ PUBLIC connect revoked on '$DB'"
done

echo ""
echo "======================================================"
echo " ✔ Access summary for '$APP_USER':"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT datname FROM pg_database
  WHERE has_database_privilege('$APP_USER', datname, 'CONNECT')
  AND datistemplate = false
  AND datname != 'postgres'
  ORDER BY datname;" | while read -r DB; do
  echo "   ✅ $DB"
done
echo "======================================================"

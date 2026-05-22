#!/bin/bash
# =============================================================
# Script: grant_user_databases.sh
# Purpose: Grant an existing user access to multiple databases
# Usage:   ./grant_user_databases.sh <username> <db1> <db2> <db3> ...
# Example: ./grant_user_databases.sh app_sales sales_db analytics_db reports_db
# =============================================================

DB_HOST="172.30.19.51"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

# ---------- Input validation ----------
if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <username> <db1> <db2> ..."
  echo "Example: $0 app_sales sales_db analytics_db reports_db"
  exit 1
fi

APP_USER="$1"
shift  # Remove username from args, rest are databases
DATABASES=("$@")

echo "======================================================"
echo " User     : $APP_USER"
echo " Databases: ${DATABASES[*]}"
echo "======================================================"

# Step 1: Check if user exists
USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER';")

if [ "$USER_EXISTS" != "1" ]; then
  echo "ERROR: User '$APP_USER' does not exist!"
  echo "Tip: First create user using ./create_app_user.sh"
  exit 1
fi

# Step 2: Ensure global_rw role is assigned to user
ROLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_auth_members m
   JOIN pg_roles r ON r.oid = m.roleid
   JOIN pg_roles u ON u.oid = m.member
   WHERE r.rolname = '$ROLE_NAME' AND u.rolname = '$APP_USER';")

if [ "$ROLE_EXISTS" != "1" ]; then
  echo "-> Assigning '$ROLE_NAME' role to '$APP_USER'..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
    "GRANT $ROLE_NAME TO \"$APP_USER\";"
  echo "✔ Role assigned."
else
  echo "✔ Role '$ROLE_NAME' already assigned to '$APP_USER'."
fi

echo ""

# Step 3: Loop through each database and grant CONNECT
for DB in "${DATABASES[@]}"; do
  echo "------------------------------------------------------"
  echo " Processing: $DB"
  echo "------------------------------------------------------"

  # Check DB exists
  DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB';")

  if [ "$DB_EXISTS" != "1" ]; then
    echo "  ⚠ WARNING: Database '$DB' does not exist! Skipping..."
    continue
  fi

  # Check if CONNECT already granted
  CONNECT_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_database d
     JOIN pg_roles r ON r.rolname = '$APP_USER'
     WHERE d.datname = '$DB'
     AND has_database_privilege('$APP_USER', '$DB', 'CONNECT');")

  if [ "$CONNECT_EXISTS" = "1" ]; then
    echo "  ✔ CONNECT already granted on '$DB'. Skipping..."
    continue
  fi

  # Grant CONNECT
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
    "GRANT CONNECT ON DATABASE \"$DB\" TO \"$APP_USER\";"
  echo "  ✔ CONNECT granted on '$DB'"

  # Revoke PUBLIC connect (security best practice)
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
    "REVOKE CONNECT ON DATABASE \"$DB\" FROM PUBLIC;"
  echo "  ✔ PUBLIC connect revoked on '$DB'"

done

echo ""
echo "======================================================"
echo " ✔ Done! Access summary for '$APP_USER':"
echo "======================================================"

# Step 4: Print final access summary for the user
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT datname FROM pg_database
   WHERE has_database_privilege('$APP_USER', datname, 'CONNECT')
   AND datistemplate = false
   ORDER BY datname;" | while read -r DB; do
  echo "  -> $DB ✅"
done

echo "======================================================"

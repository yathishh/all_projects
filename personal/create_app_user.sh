#!/bin/bash
# =============================================================
# Script: create_app_user.sh
# Purpose: Create an app user and grant access to specific DB only
# Usage: ./create_app_user.sh <username> <password> <database>
# Example: ./create_app_user.sh app_sales Secret@123 sales_db
# =============================================================

DB_HOST="172.30.19.51"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

# ---------- Input validation ----------
if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <username> <password> <database>"
  echo "Example: $0 app_sales 'Secret@123' sales_db"
  exit 1
fi

APP_USER="$1"
APP_PASS="$2"
TARGET_DB="$3"

echo "======================================================"
echo " Creating user : $APP_USER"
echo " Target DB     : $TARGET_DB"
echo "======================================================"

# Step 1: Verify the target database exists
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB';")

if [ "$DB_EXISTS" != "1" ]; then
  echo "ERROR: Database '$TARGET_DB' does not exist!"
  exit 1
fi

# Step 2: Check if user already exists
USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER';")

if [ "$USER_EXISTS" = "1" ]; then
  echo "WARNING: User '$APP_USER' already exists. Skipping creation."
else
  # Step 3: Create the user
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres <<EOF
CREATE USER "$APP_USER" WITH
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS
  CONNECTION LIMIT 50
  PASSWORD '$APP_PASS';
EOF
  echo "✔ User '$APP_USER' created."
fi

# Step 4: Assign global_rw role
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
  "GRANT $ROLE_NAME TO \"$APP_USER\";"
echo "✔ Role '$ROLE_NAME' granted to '$APP_USER'."

# Step 5: Grant CONNECT only on the specific target DB
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
  "GRANT CONNECT ON DATABASE \"$TARGET_DB\" TO \"$APP_USER\";"
echo "✔ CONNECT granted on '$TARGET_DB'."

# Step 6: Restrict - revoke public connect on target DB (security best practice)
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c \
  "REVOKE CONNECT ON DATABASE \"$TARGET_DB\" FROM PUBLIC;"
echo "✔ PUBLIC connect revoked on '$TARGET_DB'."

echo ""
echo "======================================================"
echo " ✔ User '$APP_USER' setup COMPLETE!"
echo "   -> Can connect to : $TARGET_DB ONLY"
echo "   -> Has role       : $ROLE_NAME (rw on all schemas)"
echo "======================================================"

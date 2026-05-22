#!/bin/bash
# =============================================================
# Script: cleanup.sh
# Purpose: Safely remove app user, revoke roles, drop database
# Usage:
#   Remove user only       : ./cleanup.sh --user <username>
#   Remove database only   : ./cleanup.sh --db <database>
#   Remove user + database : ./cleanup.sh --user <username> --db <database>
#   Remove global_rw role  : ./cleanup.sh --role
#
# Examples:
#   ./cleanup.sh --user test_qip_user
#   ./cleanup.sh --db qip_db_test
#   ./cleanup.sh --user test_qip_user --db qip_db_test
#   ./cleanup.sh --user test_qip_user --db qip_db_test --role
# =============================================================

DB_HOST="172.30.19.51"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

DROP_USER=""
DROP_DB=""
DROP_ROLE=false

# ---------- Parse arguments ----------
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --user) DROP_USER="$2"; shift ;;
    --db)   DROP_DB="$2";   shift ;;
    --role) DROP_ROLE=true ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 --user <username> --db <database> --role"
      exit 1
      ;;
  esac
  shift
done

if [ -z "$DROP_USER" ] && [ -z "$DROP_DB" ] && [ "$DROP_ROLE" = false ]; then
  echo "Usage:"
  echo "  ./cleanup.sh --user <username>"
  echo "  ./cleanup.sh --db <database>"
  echo "  ./cleanup.sh --user <username> --db <database>"
  echo "  ./cleanup.sh --user <username> --db <database> --role"
  exit 1
fi

echo "======================================================"
echo " PostgreSQL Cleanup"
echo "======================================================"
[ -n "$DROP_USER" ]    && echo "  User to remove   : $DROP_USER"
[ -n "$DROP_DB" ]      && echo "  Database to drop : $DROP_DB"
[ "$DROP_ROLE" = true ] && echo "  Role to drop     : $ROLE_NAME"
echo ""

# ---------- Safety confirmation ----------
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""

# ============================================================
# STEP 1: Remove the App User
# ============================================================
if [ -n "$DROP_USER" ]; then
  echo "------------------------------------------------------"
  echo " Removing user: $DROP_USER"
  echo "------------------------------------------------------"

  # Check user exists
  USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_roles WHERE rolname = '$DROP_USER';")

  if [ "$USER_EXISTS" != "1" ]; then
    echo "  WARNING: User '$DROP_USER' does not exist. Skipping..."
  else

    # Step 1a: Revoke CONNECT from all databases
    echo "  -> Revoking CONNECT from all databases..."
    ALL_DBS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
      SELECT datname FROM pg_database
      WHERE has_database_privilege('$DROP_USER', datname, 'CONNECT')
      AND datistemplate = false
      ORDER BY datname;
    ")

    for DB in $ALL_DBS; do
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
        -c "REVOKE CONNECT ON DATABASE \"$DB\" FROM \"$DROP_USER\";"
      echo "  ✔ CONNECT revoked on: $DB"
    done

    # Step 1b: Revoke global_rw role from user
    echo "  -> Revoking role '$ROLE_NAME' from '$DROP_USER'..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "REVOKE $ROLE_NAME FROM \"$DROP_USER\";" 2>/dev/null
    echo "  ✔ Role revoked."

    # Step 1c: Terminate active sessions for this user
    echo "  -> Terminating active sessions for '$DROP_USER'..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c "
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE usename = '$DROP_USER'
      AND pid <> pg_backend_pid();
    "
    echo "  ✔ Sessions terminated."

    # Step 1d: Drop the user
    echo "  -> Dropping user '$DROP_USER'..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "DROP USER \"$DROP_USER\";"

    # Verify
    STILL_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
      "SELECT 1 FROM pg_roles WHERE rolname = '$DROP_USER';")

    if [ "$STILL_EXISTS" != "1" ]; then
      echo "  ✔ User '$DROP_USER' dropped successfully."
    else
      echo "  ❌ ERROR: User '$DROP_USER' could not be dropped!"
      echo "     Tip: Check if user owns any objects using:"
      echo "     SELECT * FROM pg_tables WHERE tableowner = '$DROP_USER';"
    fi
  fi
  echo ""
fi

# ============================================================
# STEP 2: Drop the Database
# ============================================================
if [ -n "$DROP_DB" ]; then
  echo "------------------------------------------------------"
  echo " Dropping database: $DROP_DB"
  echo "------------------------------------------------------"

  # Check DB exists
  DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_database WHERE datname = '$DROP_DB';")

  if [ "$DB_EXISTS" != "1" ]; then
    echo "  WARNING: Database '$DROP_DB' does not exist. Skipping..."
  else

    # Step 2a: Terminate ALL active connections to this DB
    echo "  -> Terminating all connections to '$DROP_DB'..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c "
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '$DROP_DB'
      AND pid <> pg_backend_pid();
    "
    echo "  ✔ All connections terminated."

    # Step 2b: Drop the database
    echo "  -> Dropping database '$DROP_DB'..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "DROP DATABASE \"$DROP_DB\";"

    # Verify
    STILL_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
      "SELECT 1 FROM pg_database WHERE datname = '$DROP_DB';")

    if [ "$STILL_EXISTS" != "1" ]; then
      echo "  ✔ Database '$DROP_DB' dropped successfully."
    else
      echo "  ❌ ERROR: Database '$DROP_DB' could not be dropped!"
    fi
  fi
  echo ""
fi

# ============================================================
# STEP 3: Drop global_rw Role (only if --role flag passed)
# ============================================================
if [ "$DROP_ROLE" = true ]; then
  echo "------------------------------------------------------"
  echo " Dropping role: $ROLE_NAME"
  echo "------------------------------------------------------"

  ROLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE_NAME';")

  if [ "$ROLE_EXISTS" != "1" ]; then
    echo "  WARNING: Role '$ROLE_NAME' does not exist. Skipping..."
  else

    # Check if any users still have this role
    MEMBERS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
      SELECT u.rolname
      FROM pg_auth_members m
      JOIN pg_roles r ON r.oid = m.roleid
      JOIN pg_roles u ON u.oid = m.member
      WHERE r.rolname = '$ROLE_NAME';
    ")

    if [ -n "$MEMBERS" ]; then
      echo "  WARNING: The following users still have '$ROLE_NAME' role:"
      echo "  $MEMBERS"
      echo "  -> Revoking role from all members first..."
      for MEMBER in $MEMBERS; do
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
          -c "REVOKE $ROLE_NAME FROM \"$MEMBER\";"
        echo "  ✔ Revoked from: $MEMBER"
      done
    fi

    # Drop the role
    echo "  -> Dropping role '$ROLE_NAME'..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "DROP ROLE $ROLE_NAME;"

    STILL_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
      "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE_NAME';")

    if [ "$STILL_EXISTS" != "1" ]; then
      echo "  ✔ Role '$ROLE_NAME' dropped successfully."
    else
      echo "  ❌ ERROR: Role '$ROLE_NAME' could not be dropped!"
      echo "     Tip: Check if role owns any objects."
    fi
  fi
  echo ""
fi

echo "======================================================"
echo " ✔ Cleanup COMPLETE!"
echo "======================================================"

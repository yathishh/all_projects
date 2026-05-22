#!/bin/bash
# =============================================================
# Script  : 06_cleanup.sh
# Purpose : Safely remove user, database, or global_rw role
# Usage   :
#   Remove user only       : ./06_cleanup.sh --user <username>
#   Remove database only   : ./06_cleanup.sh --db <database>
#   Remove user + database : ./06_cleanup.sh --user <u> --db <db>
#   Remove role            : ./06_cleanup.sh --role
# =============================================================

source "$(dirname "$0")/pg_config.sh"

DROP_USER=""
DROP_DB=""
DROP_ROLE=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --user) DROP_USER="$2"; shift ;;
    --db)   DROP_DB="$2";   shift ;;
    --role) DROP_ROLE=true ;;
    *) echo "Unknown option: $1"
       echo "Usage: $0 --user <username> --db <database> --role"
       exit 1 ;;
  esac
  shift
done

if [ -z "$DROP_USER" ] && [ -z "$DROP_DB" ] && [ "$DROP_ROLE" = false ]; then
  echo "Usage:"
  echo "  $0 --user <username>"
  echo "  $0 --db <database>"
  echo "  $0 --user <username> --db <database>"
  echo "  $0 --user <username> --db <database> --role"
  exit 1
fi

echo "======================================================"
echo " [06] Cleanup"
[ -n "$DROP_USER" ]     && echo "  User to remove   : $DROP_USER"
[ -n "$DROP_DB" ]       && echo "  Database to drop : $DROP_DB"
[ "$DROP_ROLE" = true ] && echo "  Role to drop     : $ROLE_NAME"
echo "======================================================"

read -p "Are you sure? (yes/no): " CONFIRM
[ "$CONFIRM" != "yes" ] && echo "Aborted." && exit 0
echo ""

# ============================================================
# Remove User
# ============================================================
if [ -n "$DROP_USER" ]; then
  echo "------------------------------------------------------"
  echo " Removing user: $DROP_USER"
  echo "------------------------------------------------------"

  USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_roles WHERE rolname = '$DROP_USER';")

  if [ "$USER_EXISTS" != "1" ]; then
    echo "  WARNING: User '$DROP_USER' not found. Skipping..."
  else
    echo "  -> Terminating sessions..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c "
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE usename = '$DROP_USER' AND pid <> pg_backend_pid();" > /dev/null

    echo "  -> Revoking role..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "REVOKE $ROLE_NAME FROM \"$DROP_USER\";" > /dev/null 2>&1

    echo "  -> Revoking CONNECT on all databases..."
    ALL_DBS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
      SELECT datname FROM pg_database WHERE datistemplate = false;")
    for DB in $ALL_DBS; do
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
        -c "REVOKE CONNECT ON DATABASE \"$DB\" FROM \"$DROP_USER\";" > /dev/null 2>&1
    done

    echo "  -> Dropping user..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "DROP USER \"$DROP_USER\";" > /dev/null

    STILL=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
      "SELECT 1 FROM pg_roles WHERE rolname = '$DROP_USER';")
    [ "$STILL" != "1" ] \
      && echo "  ✔ User '$DROP_USER' dropped." \
      || echo "  ❌ Could not drop '$DROP_USER'. May own objects."
  fi
  echo ""
fi

# ============================================================
# Drop Database
# ============================================================
if [ -n "$DROP_DB" ]; then
  echo "------------------------------------------------------"
  echo " Dropping database: $DROP_DB"
  echo "------------------------------------------------------"

  DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_database WHERE datname = '$DROP_DB';")

  if [ "$DB_EXISTS" != "1" ]; then
    echo "  WARNING: Database '$DROP_DB' not found. Skipping..."
  else
    echo "  -> Terminating all connections..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c "
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = '$DROP_DB' AND pid <> pg_backend_pid();" > /dev/null

    echo "  -> Dropping database..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "DROP DATABASE \"$DROP_DB\";" > /dev/null

    STILL=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
      "SELECT 1 FROM pg_database WHERE datname = '$DROP_DB';")
    [ "$STILL" != "1" ] \
      && echo "  ✔ Database '$DROP_DB' dropped." \
      || echo "  ❌ Could not drop '$DROP_DB'."
  fi
  echo ""
fi

# ============================================================
# Drop global_rw Role
# ============================================================
if [ "$DROP_ROLE" = true ]; then
  echo "------------------------------------------------------"
  echo " Dropping role: $ROLE_NAME"
  echo "------------------------------------------------------"

  ROLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE_NAME';")

  if [ "$ROLE_EXISTS" != "1" ]; then
    echo "  WARNING: Role '$ROLE_NAME' not found. Skipping..."
  else
    # Revoke from all members first
    MEMBERS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
      SELECT u.rolname FROM pg_auth_members m
      JOIN pg_roles r ON r.oid = m.roleid
      JOIN pg_roles u ON u.oid = m.member
      WHERE r.rolname = '$ROLE_NAME';")

    for MEMBER in $MEMBERS; do
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
        -c "REVOKE $ROLE_NAME FROM \"$MEMBER\";" > /dev/null
      echo "  ✔ Revoked from: $MEMBER"
    done

    # Revoke all privileges from all DBs
    ALL_DBS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
      SELECT datname FROM pg_database
      WHERE datistemplate = false AND datname != 'postgres';")

    for DB in $ALL_DBS; do
      SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc "
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
        AND schema_name NOT LIKE 'pg_%';")
      for SCHEMA in $SCHEMAS; do
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
          -c "REVOKE ALL ON ALL TABLES IN SCHEMA \"$SCHEMA\" FROM $ROLE_NAME;" > /dev/null 2>&1
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
          -c "REVOKE ALL ON ALL SEQUENCES IN SCHEMA \"$SCHEMA\" FROM $ROLE_NAME;" > /dev/null 2>&1
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
          -c "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA \"$SCHEMA\" FROM $ROLE_NAME;" > /dev/null 2>&1
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
          -c "REVOKE ALL ON SCHEMA \"$SCHEMA\" FROM $ROLE_NAME;" > /dev/null 2>&1
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
          -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" REVOKE ALL ON TABLES FROM $ROLE_NAME;" > /dev/null 2>&1
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
          -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" REVOKE ALL ON SEQUENCES FROM $ROLE_NAME;" > /dev/null 2>&1
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
          -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" REVOKE ALL ON FUNCTIONS FROM $ROLE_NAME;" > /dev/null 2>&1
      done
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
        -c "REVOKE ALL ON DATABASE \"$DB\" FROM $ROLE_NAME;" > /dev/null 2>&1
      echo "  ✔ Revoked all privileges in: $DB"
    done

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "DROP ROLE $ROLE_NAME;" > /dev/null

    STILL=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
      "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE_NAME';")
    [ "$STILL" != "1" ] \
      && echo "  ✔ Role '$ROLE_NAME' dropped." \
      || echo "  ❌ Could not drop role. Check remaining dependencies."
  fi
  echo ""
fi

echo "======================================================"
echo " ✔ Cleanup COMPLETE!"
echo "======================================================"

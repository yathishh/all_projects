#!/bin/bash
# =============================================================
# Script: fix_and_setup.sh
# Purpose: Fully automated fix for:
#   1. rolinherit=f + inherit_option=f (PG16 fix)
#   2. User sees all DBs (revoke PUBLIC connect)
#   3. Schemas showing no access (grant all missed schemas)
#   4. Recreate user cleanly with correct settings
#
# Usage:   ./fix_and_setup.sh <username> <password> <target_database>
# Example: ./fix_and_setup.sh test_qip_user 'yNk3F4yVvWokFQUFgBqNv5oYf' qip_db_test
# =============================================================

DB_HOST="172.30.19.51"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

# ---------- Input validation ----------
if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <username> <password> <target_database>"
  echo "Example: $0 test_qip_user 'yNk3F4yVvWokFQUFgBqNv5oYf' qip_db_test"
  exit 1
fi

APP_USER="$1"
APP_PASS="$2"
TARGET_DB="$3"

echo "======================================================"
echo " Full Automated Fix & Setup"
echo " User     : $APP_USER"
echo " Target DB: $TARGET_DB"
echo "======================================================"
echo ""

# ============================================================
# FIX 1: Grant global_rw on ALL missed schemas across ALL DBs
# ============================================================
echo "------------------------------------------------------"
echo " FIX 1: Granting global_rw on all missed schemas"
echo "------------------------------------------------------"

DATABASES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT datname FROM pg_database
  WHERE datistemplate = false
  AND datname NOT IN ('postgres','rdsadmin')
  ORDER BY datname;
")

for DB in $DATABASES; do
  echo " -> Database: $DB"

  SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc "
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
    AND schema_name NOT LIKE 'pg_%'
    ORDER BY schema_name;
  ")

  for SCHEMA in $SCHEMAS; do
    # Skip if already granted
    HAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc \
      "SELECT has_schema_privilege('$ROLE_NAME', '$SCHEMA', 'USAGE');")

    if [ "$HAS" = "t" ]; then
      echo "    ✔ Already granted: $SCHEMA"
      continue
    fi

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "GRANT USAGE ON SCHEMA \"$SCHEMA\" TO $ROLE_NAME;" > /dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA \"$SCHEMA\" TO $ROLE_NAME;" > /dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA \"$SCHEMA\" TO $ROLE_NAME;" > /dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA \"$SCHEMA\" TO $ROLE_NAME;" > /dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $ROLE_NAME;" > /dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $ROLE_NAME;" > /dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" GRANT EXECUTE ON FUNCTIONS TO $ROLE_NAME;" > /dev/null

    VERIFY=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc \
      "SELECT has_schema_privilege('$ROLE_NAME', '$SCHEMA', 'USAGE');")
    [ "$VERIFY" = "t" ] \
      && echo "    ✔ Granted: $SCHEMA" \
      || echo "    ❌ FAILED: $SCHEMA"
  done
done

echo " ✔ FIX 1 COMPLETE: All schemas granted to $ROLE_NAME"
echo ""

# ============================================================
# FIX 2: Revoke PUBLIC connect on ALL DBs
#         Keep explicit grants for existing login users
# ============================================================
echo "------------------------------------------------------"
echo " FIX 2: Revoking PUBLIC connect + fixing existing users"
echo "------------------------------------------------------"

# First, give all existing login users explicit CONNECT on their DBs
# so they don't lose access when PUBLIC is revoked
EXISTING_USERS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT rolname FROM pg_roles
  WHERE rolcanlogin = true
  AND rolname NOT IN ('postgres', 'rdsadmin', '$APP_USER')
  ORDER BY rolname;
")

for EUSER in $EXISTING_USERS; do
  EDBS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
    SELECT datname FROM pg_database
    WHERE has_database_privilege('$EUSER', datname, 'CONNECT')
    AND datistemplate = false
    AND datname != 'postgres'
    ORDER BY datname;
  ")
  for EDB in $EDBS; do
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "GRANT CONNECT ON DATABASE \"$EDB\" TO \"$EUSER\";" > /dev/null
  done
  echo "  ✔ Preserved CONNECT grants for existing user: $EUSER"
done

# Now revoke PUBLIC connect on all DBs
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres > /dev/null <<'PLPGSQL'
DO $$
DECLARE db RECORD;
BEGIN
  FOR db IN
    SELECT datname FROM pg_database
    WHERE datistemplate = false
    AND datname != 'postgres'
  LOOP
    EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', db.datname);
    RAISE NOTICE 'Revoked PUBLIC on: %', db.datname;
  END LOOP;
END;
$$;
PLPGSQL

echo "  ✔ PUBLIC connect revoked on all databases"
echo " ✔ FIX 2 COMPLETE"
echo ""

# ============================================================
# FIX 3: Remove and Recreate App User with Correct Settings
# ============================================================
echo "------------------------------------------------------"
echo " FIX 3: Recreating '$APP_USER' with correct settings"
echo "------------------------------------------------------"

# Drop user if exists
USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER';")

if [ "$USER_EXISTS" = "1" ]; then
  echo "  -> Terminating active sessions for '$APP_USER'..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE usename = '$APP_USER'
    AND pid <> pg_backend_pid();
  " > /dev/null

  echo "  -> Revoking all grants from '$APP_USER'..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "REVOKE $ROLE_NAME FROM \"$APP_USER\";" > /dev/null

  ALL_DBS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
    SELECT datname FROM pg_database
    WHERE datistemplate = false ORDER BY datname;
  ")
  for DB in $ALL_DBS; do
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
      -c "REVOKE CONNECT ON DATABASE \"$DB\" FROM \"$APP_USER\";" > /dev/null 2>&1
  done

  echo "  -> Dropping user '$APP_USER'..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "DROP USER \"$APP_USER\";" > /dev/null
  echo "  ✔ Old user dropped."
fi

# Recreate user with INHERIT=true (PG16 compatible)
echo "  -> Creating user '$APP_USER' with INHERIT=true..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c "
  CREATE USER \"$APP_USER\" WITH
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    INHERIT
    NOREPLICATION
    NOBYPASSRLS
    CONNECTION LIMIT 50
    PASSWORD '$APP_PASS';
"
echo "  ✔ User '$APP_USER' created with INHERIT=true."

# Grant global_rw WITH INHERIT TRUE (PG16 fix)
echo "  -> Granting '$ROLE_NAME' WITH INHERIT TRUE..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
  -c "GRANT $ROLE_NAME TO \"$APP_USER\" WITH INHERIT TRUE;"
echo "  ✔ Role granted with INHERIT TRUE."

# Grant CONNECT only on target DB
echo "  -> Granting CONNECT on '$TARGET_DB' only..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
  -c "GRANT CONNECT ON DATABASE \"$TARGET_DB\" TO \"$APP_USER\";"
echo "  ✔ CONNECT granted on '$TARGET_DB' only."

echo " ✔ FIX 3 COMPLETE"
echo ""

# ============================================================
# FINAL VERIFICATION
# ============================================================
echo "======================================================"
echo " FINAL VERIFICATION"
echo "======================================================"

# Check rolinherit
ROLINHERIT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT rolinherit FROM pg_roles WHERE rolname = '$APP_USER';")

# Check inherit_option
INHERIT_OPT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT m.inherit_option
  FROM pg_auth_members m
  JOIN pg_roles r ON r.oid = m.roleid
  JOIN pg_roles u ON u.oid = m.member
  WHERE r.rolname = '$ROLE_NAME' AND u.rolname = '$APP_USER';
")

# Check DB count
DB_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT count(*) FROM pg_database
  WHERE has_database_privilege('$APP_USER', datname, 'CONNECT')
  AND datistemplate = false;
")

# Check schema access on target DB
SCHEMA_ACCESS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$TARGET_DB" -Atc "
  SELECT string_agg(schema_name, ', ' ORDER BY schema_name)
  FROM information_schema.schemata
  WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
  AND schema_name NOT LIKE 'pg_%'
  AND has_schema_privilege('$APP_USER', schema_name, 'USAGE');
")

echo ""
echo "  rolinherit         : $ROLINHERIT     $([ "$ROLINHERIT" = "t" ] && echo "✅" || echo "❌")"
echo "  inherit_option     : $INHERIT_OPT     $([ "$INHERIT_OPT" = "t" ] && echo "✅" || echo "❌")"
echo "  Databases visible  : $DB_COUNT        $([ "$DB_COUNT" = "1" ] && echo "✅ (only $TARGET_DB)" || echo "❌ (should be 1)")"
echo "  Schema access in '$TARGET_DB': ${SCHEMA_ACCESS:-none} $([ -n "$SCHEMA_ACCESS" ] && echo "✅" || echo "❌")"
echo ""

# Overall result
if [ "$ROLINHERIT" = "t" ] && [ "$INHERIT_OPT" = "t" ] && [ "$DB_COUNT" = "1" ] && [ -n "$SCHEMA_ACCESS" ]; then
  echo "======================================================"
  echo " ✅ ALL CHECKS PASSED! '$APP_USER' is ready to use."
  echo "   -> Connect to : $TARGET_DB"
  echo "   -> Schemas    : $SCHEMA_ACCESS"
  echo "======================================================"
else
  echo "======================================================"
  echo " ❌ SOME CHECKS FAILED — Run ./verify_user.sh $APP_USER"
  echo "======================================================"
  exit 1
fi

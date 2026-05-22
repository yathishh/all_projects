#!/bin/bash
# =============================================================
# Script  : 01_setup_global_rw.sh
# Purpose : Create global_rw role + grant RW on ALL schemas
#           across ALL databases in the cluster
# Usage   : ./01_setup_global_rw.sh
# Run     : ONCE when setting up a new cluster
# Note    : CONNECT is NOT granted at role level (per user only)
# =============================================================

source "$(dirname "$0")/pg_config.sh"

echo "======================================================"
echo " [01] Setup global_rw Role"
echo " Host : $DB_HOST"
echo "======================================================"

# ---------- Step 1: Create role if not exists ----------
ROLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE_NAME';")

if [ "$ROLE_EXISTS" = "1" ]; then
  echo "✔ Role '$ROLE_NAME' already exists."
else
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres -c "
    CREATE ROLE $ROLE_NAME WITH
      NOSUPERUSER NOCREATEDB NOCREATEROLE
      INHERIT NOLOGIN NOREPLICATION
      NOBYPASSRLS CONNECTION LIMIT -1;"
  echo "✔ Role '$ROLE_NAME' created."
fi

# ---------- Step 2: Get all user databases ----------
DATABASES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT datname FROM pg_database
  WHERE datistemplate = false
  AND datname NOT IN ('postgres','rdsadmin')
  ORDER BY datname;")

if [ -z "$DATABASES" ]; then
  echo "ERROR: No databases found!"; exit 1
fi

echo ""
echo "Databases found:"
echo "$DATABASES"
echo ""

# ---------- Step 3: Revoke PUBLIC connect on ALL databases ----------
echo "------------------------------------------------------"
echo " Revoking PUBLIC connect on all databases"
echo "------------------------------------------------------"
ALL_REVOKE_DBS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;")
for DB in $ALL_REVOKE_DBS; do
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "REVOKE CONNECT ON DATABASE \"$DB\" FROM PUBLIC;" > /dev/null
  echo "  ✔ PUBLIC revoked: $DB"
done
echo "  NOTE: CONNECT granted per user only via 02_create_app_user.sh"
echo ""

# ---------- Step 4: Grant on all schemas in each DB ----------
for DB in $DATABASES; do
  echo "------------------------------------------------------"
  echo " Database: $DB"
  echo "------------------------------------------------------"

  SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc "
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
    AND schema_name NOT LIKE 'pg_%'
    ORDER BY schema_name;")

  if [ -z "$SCHEMAS" ]; then
    echo "  No user schemas found. Skipping..."
    continue
  fi

  for SCHEMA in $SCHEMAS; do
    HAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc \
      "SELECT has_schema_privilege('$ROLE_NAME', '$SCHEMA', 'USAGE');")

    if [ "$HAS" = "t" ]; then
      echo "  ✔ Already granted : $SCHEMA"
      continue
    fi

    echo "  -> Granting on   : $SCHEMA"
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
    [ "$VERIFY" = "t" ] && echo "  ✔ Done            : $SCHEMA" || echo "  ❌ FAILED         : $SCHEMA"
  done
done

echo ""
echo "======================================================"
echo " ✔ global_rw setup COMPLETE across all databases"
echo "   CONNECT is NOT granted at role level"
echo "   Use 02_create_app_user.sh to create users"
echo "======================================================"

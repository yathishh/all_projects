#!/bin/bash
# Run on your machine — revokes global_rw from every DB then drops role

DB_HOST="172.30.19.51"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

echo "Revoking global_rw from all databases..."

DATABASES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT datname FROM pg_database
  WHERE datistemplate = false
  AND datname != 'postgres'
  ORDER BY datname;
")

for DB in $DATABASES; do
  echo "-> Revoking from: $DB"

  # Get all schemas in this DB
  SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" -Atc "
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
    AND schema_name NOT LIKE 'pg_%';
  ")

  for SCHEMA in $SCHEMAS; do
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "REVOKE ALL ON ALL TABLES IN SCHEMA \"$SCHEMA\" FROM $ROLE_NAME;" 2>/dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "REVOKE ALL ON ALL SEQUENCES IN SCHEMA \"$SCHEMA\" FROM $ROLE_NAME;" 2>/dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA \"$SCHEMA\" FROM $ROLE_NAME;" 2>/dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "REVOKE ALL ON SCHEMA \"$SCHEMA\" FROM $ROLE_NAME;" 2>/dev/null

    # Remove default privileges too
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" REVOKE ALL ON TABLES FROM $ROLE_NAME;" 2>/dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" REVOKE ALL ON SEQUENCES FROM $ROLE_NAME;" 2>/dev/null
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB" \
      -c "ALTER DEFAULT PRIVILEGES IN SCHEMA \"$SCHEMA\" REVOKE ALL ON FUNCTIONS FROM $ROLE_NAME;" 2>/dev/null

    echo "   ✔ $DB -> $SCHEMA"
  done

  # Revoke CONNECT on DB level too
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "REVOKE ALL ON DATABASE \"$DB\" FROM $ROLE_NAME;" 2>/dev/null

done

echo ""
echo "-> Now dropping role $ROLE_NAME..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
  -c "DROP ROLE $ROLE_NAME;"

# Verify
STILL_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
  "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE_NAME';")

if [ "$STILL_EXISTS" != "1" ]; then
  echo "✔ Role '$ROLE_NAME' dropped successfully!"
else
  echo "❌ Still cannot drop — check remaining dependencies:"
  echo "   SELECT * FROM pg_shdepend WHERE refobjid = (SELECT oid FROM pg_roles WHERE rolname = '$ROLE_NAME');"
fi

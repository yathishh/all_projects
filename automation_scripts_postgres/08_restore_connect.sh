#!/bin/bash
# =============================================================
# Script  : 08_restore_connect.sh
# Purpose : Read postgres log + restore CONNECT for all users
#           who lost access (after PUBLIC revoke)
# Usage   : ./08_restore_connect.sh [log_file_path]
# Example : ./08_restore_connect.sh
#           ./08_restore_connect.sh /var/log/postgresql/postgresql-2026-04-28_000000.log
# =============================================================

source "$(dirname "$0")/pg_config.sh"

# Auto-detect today's log if not provided
if [ -n "$1" ]; then
  LOG_FILE="$1"
else
  LOG_FILE="/var/log/postgresql/postgresql-$(date +%Y-%m-%d)_000000.log"
fi

echo "======================================================"
echo " [08] Restore CONNECT from Log"
echo " Log : $LOG_FILE"
echo "======================================================"

if [ ! -f "$LOG_FILE" ]; then
  echo "ERROR: Log file not found: $LOG_FILE"
  echo "Tip  : Pass log path manually: $0 /path/to/postgresql.log"
  exit 1
fi

# ---------- Step 1: Parse log for affected users ----------
echo ""
echo "[ Step 1: Scanning log for affected users ]"

AFFECTED=$(grep "does not have CONNECT privilege" "$LOG_FILE" \
  | grep -oP 'user=\K[^,]+(?=,db=)|(?<=,db=)[^,]+(?=,)' \
  | paste - - \
  | sort -u)

if [ -z "$AFFECTED" ]; then
  echo "✔ No CONNECT errors found in log. Nothing to fix!"
  exit 0
fi

echo " Affected user → database pairs:"
echo "$AFFECTED" | while read -r USER DB; do
  echo "   ❌ $USER → $DB"
done
echo ""

# ---------- Step 2: Restore CONNECT for each ----------
echo "[ Step 2: Restoring CONNECT privileges ]"
echo ""

echo "$AFFECTED" | while read -r USER DB; do
  USER_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_roles WHERE rolname = '$USER';")
  if [ "$USER_EXISTS" != "1" ]; then
    echo "  ⚠ User '$USER' not found. Skipping..."
    continue
  fi

  DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB';")
  if [ "$DB_EXISTS" != "1" ]; then
    echo "  ⚠ Database '$DB' not found. Skipping..."
    continue
  fi

  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d postgres \
    -c "GRANT CONNECT ON DATABASE \"$DB\" TO \"$USER\";" > /dev/null

  VERIFY=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc \
    "SELECT has_database_privilege('$USER', '$DB', 'CONNECT');")
  [ "$VERIFY" = "t" ] \
    && echo "  ✅ Restored : $USER → $DB" \
    || echo "  ❌ FAILED   : $USER → $DB"
done

# ---------- Step 3: Full access summary ----------
echo ""
echo "[ Step 3: Full Access Summary ]"
echo ""

ALL_USERS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
  SELECT rolname FROM pg_roles
  WHERE rolcanlogin = true
  AND rolname NOT IN ('postgres','rdsadmin')
  ORDER BY rolname;")

for USER in $ALL_USERS; do
  DBS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -Atc "
    SELECT string_agg(datname, ', ' ORDER BY datname)
    FROM pg_database
    WHERE has_database_privilege('$USER', datname, 'CONNECT')
    AND datistemplate = false
    AND datname != 'postgres';")
  if [ -n "$DBS" ]; then
    echo "  ✅ $USER  →  $DBS"
  else
    echo "  ❌ $USER  →  NO DATABASE ACCESS!"
  fi
done

echo ""
echo "======================================================"
echo " ✔ Restore Complete! Apps will reconnect automatically."
echo "======================================================"

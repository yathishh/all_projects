#!/bin/bash
# ============================================================
# Fix 1: Regenerate 001-roles.sql with proper quoted names
# Fix 2: Run changelog-sync to mark everything as already applied
# ============================================================

DB_HOST="pgsql_cluster.dev1.adhkistaging.com"
DB_PORT="5432"
DB_USER="postgres"
export PGPASSWORD="postgres"
REPO="$HOME/liquibase-CI-CD"
DB_NAME="ellie_ai_chatbot"
SAFE_DB="ellie_ai_chatbot"

run_psql() {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d "$1" -t -A -c "$2" 2>/dev/null
}

# Detect schema
SCHEMA=$(run_psql "$DB_NAME" \
    "SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_toast','pg_catalog','information_schema')
     AND schema_name NOT LIKE 'pg_%'
     ORDER BY CASE WHEN schema_name='public' THEN 1 ELSE 0 END
     LIMIT 1;")
SCHEMA=$(echo "$SCHEMA" | xargs)
echo "Schema: $SCHEMA"

FILE="$REPO/databases/$DB_NAME/modules/$SCHEMA/001-roles.sql"

cat > $FILE << SQLEOF
--liquibase formatted sql

-- ============================================================
-- 001-roles.sql — $DB_NAME
-- Fixed: hyphenated names properly double-quoted
-- ============================================================

--changeset dba:${SAFE_DB}-${SCHEMA}-roles-001 runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

SQLEOF

# ── Write roles ───────────────────────────────────────────────
echo "Extracting roles..."
run_psql "$DB_NAME" \
    "SELECT
        rolname,
        CASE WHEN rolsuper      THEN 'SUPERUSER'   ELSE '' END,
        CASE WHEN rolcreatedb   THEN 'CREATEDB'    ELSE '' END,
        CASE WHEN rolcreaterole THEN 'CREATEROLE'  ELSE '' END,
        CASE WHEN rolinherit    THEN 'INHERIT'     ELSE 'NOINHERIT' END,
        CASE WHEN rolcanlogin   THEN 'LOGIN'       ELSE 'NOLOGIN' END,
        CASE WHEN rolreplication THEN 'REPLICATION' ELSE '' END
     FROM pg_roles
     WHERE rolname NOT LIKE 'pg_%'
     AND rolname NOT IN ('postgres','replication','monitor')
     AND rolcanlogin = false
     ORDER BY rolname;" | while IFS='|' read -r RNAME RSUPER RCREATEDB RCREATEROLE RINHERIT RLOGIN RREPL; do
    RNAME=$(echo "$RNAME" | xargs); [ -z "$RNAME" ] && continue
    ATTRS=$(echo "$RSUPER $RCREATEDB $RCREATEROLE $RINHERIT $RLOGIN $RREPL" | xargs)

    # Always use quote_ident style — wrap in double quotes if has special chars
    if echo "$RNAME" | grep -qE '[^a-z0-9_]'; then
        QRNAME="\"$RNAME\""
    else
        QRNAME="$RNAME"
    fi

    cat >> $FILE << ROLEEOF
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$RNAME') THEN
        CREATE ROLE $QRNAME $ATTRS;
        RAISE NOTICE 'Created role: $RNAME';
    ELSE
        RAISE NOTICE 'Skipped: $RNAME (already exists)';
    END IF;

ROLEEOF
done

# ── Write memberships with proper quoting ─────────────────────
echo "Extracting memberships..."
echo "" >> $FILE
echo "    -- Role memberships (double-quoted for hyphenated names)" >> $FILE

run_psql "$DB_NAME" \
    "SELECT r.rolname, m.rolname
     FROM pg_auth_members am
     JOIN pg_roles r ON r.oid = am.roleid
     JOIN pg_roles m ON m.oid = am.member
     WHERE r.rolname NOT LIKE 'pg_%'
     AND m.rolname NOT LIKE 'pg_%'
     AND r.rolname NOT IN ('postgres')
     AND m.rolname NOT IN ('postgres')
     ORDER BY r.rolname, m.rolname;" | while IFS='|' read -r GROLE GMEMBER; do
    GROLE=$(echo "$GROLE" | xargs); GMEMBER=$(echo "$GMEMBER" | xargs)
    [ -z "$GROLE" ] || [ -z "$GMEMBER" ] && continue

    # Quote if contains special chars (hyphens, dots, uppercase)
    if echo "$GROLE" | grep -qE '[^a-z0-9_]'; then
        QGROLE="\"$GROLE\""
    else
        QGROLE="$GROLE"
    fi

    if echo "$GMEMBER" | grep -qE '[^a-z0-9_]'; then
        QGMEMBER="\"$GMEMBER\""
    else
        QGMEMBER="$GMEMBER"
    fi

    # Use double-dollar to avoid quote escaping issues inside EXECUTE
    echo "    EXECUTE \$q\$GRANT $QGROLE TO $QGMEMBER\$q\$;" >> $FILE
done

cat >> $FILE << SQLEOF

END
\$\$
\$\$END

--rollback SELECT 'manual rollback — check roles before dropping';
SQLEOF

echo "✅ 001-roles.sql regenerated with proper quoting"
echo ""

# ── Fix 2: Run changelog-sync ─────────────────────────────────
echo "Running changelog-sync to mark existing structure as already applied..."
cd $REPO/databases/$DB_NAME

liquibase \
    --url="jdbc:postgresql://$DB_HOST:$DB_PORT/$DB_NAME" \
    --username=$DB_USER \
    --search-path="$(pwd)" \
    --changeLogFile="changelog-root.xml" \
    changelog-sync

echo ""
echo "✅ changelog-sync done — pipeline will now skip all existing changesets"
echo ""
echo "Now commit and push:"
echo "  cd $REPO"
echo "  git add databases/ellie_ai_chatbot/"
echo "  git commit -m 'fix: quote hyphenated role names + changelog-sync ellie_ai_chatbot'"
echo "  git push origin development"

#!/bin/bash
# ============================================================
# migrate-existing-to-liquibase.sh
# Handles BOTH public schema and custom schemas
# Auto-detects which schemas each DB uses
# ============================================================

# ── CONFIG — update these ────────────────────────────────────
DB_HOST="pgsql_cluster.dev1.adhkistaging.com"
DB_PORT="5432"
DB_USER="postgres"
REPO="$HOME/liquibase-CI-CD"

# ── Your app databases (skip system/tool DBs) ─────────────────
DATABASES=(
    "acx"
    "adhki_messaging"
    "agent_session"
    "autoform"
    "ave"
    "aws_connect"
    "basic_ivrs"
    "billing_pg50"
    "cardstream"
    "ccdbs_pg50"
    "cgno"
    "cogno_db"
    "cogno-v2"
    "contact"
    "ellie_ai_chatbot"
    "harbor-dev1"
    "keep"
    "line_testing"
    "loneworkerdb"
    "medihub"
    "msgreports_pg50"
    "msgstore_pg50"
    "new_test_db"
    "qip_db"
    "recordings_manager"
    "references"
    "reportdb"
    "robo_agent"
    "single_telephony"
    "superseva"
    "switchboard"
    "ttsdb"
    "virtualoffice"
    "wise"
)

# ── SKIP these — managed by their own tools ───────────────────
SKIP_DBS=("postgres" "keycloak" "n8n" "superset" "homer_config" "homer_data")

# ─────────────────────────────────────────────────────────────
# Helper: safe name for role/changeset (replace hyphens)
# e.g. cogno-v2 → cogno_v2
# ─────────────────────────────────────────────────────────────
safe_name() {
    echo "$1" | tr '-' '_'
}

# ─────────────────────────────────────────────────────────────
# Helper: run psql query
# ─────────────────────────────────────────────────────────────
run_psql() {
    local DB=$1
    local QUERY=$2
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d "$DB" -t -A -c "$QUERY" 2>/dev/null
}

echo "============================================"
echo " Liquibase Migration Script"
echo " Host     : $DB_HOST"
echo " Total DBs: ${#DATABASES[@]}"
echo "============================================"

for DB_NAME in "${DATABASES[@]}"; do

    SAFE_DB=$(safe_name "$DB_NAME")

    echo ""
    echo "──────────────────────────────────────────"
    echo " Processing: $DB_NAME (safe name: $SAFE_DB)"
    echo "──────────────────────────────────────────"

    # ── Check DB is reachable ─────────────────────────────────
    if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d "$DB_NAME" -c "\q" 2>/dev/null; then
        echo "  ⚠️  Cannot connect to $DB_NAME — skipping"
        continue
    fi

    # ── Discover ALL schemas (public + custom) ────────────────
    ALL_SCHEMAS=$(run_psql "$DB_NAME" \
        "SELECT schema_name
         FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_toast','pg_catalog','information_schema')
         AND schema_name NOT LIKE 'pg_%'
         ORDER BY
             CASE WHEN schema_name = 'public' THEN 1 ELSE 0 END,
             schema_name;")

    if [ -z "$ALL_SCHEMAS" ]; then
        echo "  ⚠️  No schemas found — skipping"
        continue
    fi

    # ── Filter schemas that actually have tables ──────────────
    SCHEMAS_WITH_TABLES=""
    while IFS= read -r SCH; do
        SCH=$(echo "$SCH" | xargs)
        [ -z "$SCH" ] && continue
        TABLE_COUNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema = '$SCH' AND table_type = 'BASE TABLE';")
        if [ "$TABLE_COUNT" -gt 0 ] 2>/dev/null; then
            SCHEMAS_WITH_TABLES="$SCHEMAS_WITH_TABLES $SCH"
            echo "  Found schema: $SCH ($TABLE_COUNT tables)"
        else
            echo "  Skip empty schema: $SCH"
        fi
    done <<< "$ALL_SCHEMAS"

    if [ -z "$SCHEMAS_WITH_TABLES" ]; then
        echo "  ⚠️  No schemas with tables — skipping"
        continue
    fi

    # ── Create base folder ────────────────────────────────────
    mkdir -p $REPO/databases/$DB_NAME

    cat > $REPO/databases/$DB_NAME/liquibase.properties << EOF
changeLogFile: changelog-root.xml
searchPath: .
EOF

    # ── Start changelog-root.xml ──────────────────────────────
    cat > $REPO/databases/$DB_NAME/changelog-root.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.26.xsd">

    <!-- Database  : $DB_NAME -->
    <!-- Schemas   : $SCHEMAS_WITH_TABLES -->
    <!-- Generated : $(date) -->

EOF

    IS_FIRST_SCHEMA=true

    for SCHEMA in $SCHEMAS_WITH_TABLES; do
        SCHEMA=$(echo "$SCHEMA" | xargs)
        [ -z "$SCHEMA" ] && continue

        SAFE_SCH=$(safe_name "$SCHEMA")

        echo ""
        echo "  → Schema: $SCHEMA"

        mkdir -p $REPO/databases/$DB_NAME/modules/$SCHEMA

        # Add includes to changelog
        cat >> $REPO/databases/$DB_NAME/changelog-root.xml << EOF
    <!-- ── $SCHEMA ── -->
    <include file="modules/$SCHEMA/001-roles.sql"/>
    <include file="modules/$SCHEMA/002-schema.sql"/>
    <include file="modules/$SCHEMA/003-tables.sql"/>
    <include file="modules/$SCHEMA/004-indexes.sql"/>
    <include file="modules/$SCHEMA/005-functions.sql"/>
$([ "$IS_FIRST_SCHEMA" = "true" ] && echo "    <include file=\"modules/$SCHEMA/006-users.sql\"/>")

EOF
        IS_FIRST_SCHEMA=false

        # ── 001-roles.sql ──────────────────────────────────────
        cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/001-roles.sql << EOF
--liquibase formatted sql

-- ============================================================
-- $SCHEMA/001-roles.sql — $DB_NAME
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-roles-001 runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${SAFE_DB}_owner_role') THEN
        CREATE ROLE ${SAFE_DB}_owner_role NOLOGIN;
        RAISE NOTICE 'Created role: ${SAFE_DB}_owner_role';
    ELSE
        RAISE NOTICE 'Skipped: ${SAFE_DB}_owner_role (exists)';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${SAFE_DB}_app_rw_role') THEN
        CREATE ROLE ${SAFE_DB}_app_rw_role NOLOGIN;
        RAISE NOTICE 'Created role: ${SAFE_DB}_app_rw_role';
    ELSE
        RAISE NOTICE 'Skipped: ${SAFE_DB}_app_rw_role (exists)';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${SAFE_DB}_report_ro_role') THEN
        CREATE ROLE ${SAFE_DB}_report_ro_role NOLOGIN;
        RAISE NOTICE 'Created role: ${SAFE_DB}_report_ro_role';
    ELSE
        RAISE NOTICE 'Skipped: ${SAFE_DB}_report_ro_role (exists)';
    END IF;

END
\$\$
\$\$END

--rollback DROP ROLE IF EXISTS ${SAFE_DB}_owner_role;
--rollback DROP ROLE IF EXISTS ${SAFE_DB}_app_rw_role;
--rollback DROP ROLE IF EXISTS ${SAFE_DB}_report_ro_role;
EOF

        # ── 002-schema.sql ─────────────────────────────────────
        # Handle public schema differently — cannot ALTER OWNER
        if [ "$SCHEMA" = "public" ]; then
            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/002-schema.sql << EOF
--liquibase formatted sql

-- ============================================================
-- public/002-schema.sql — $DB_NAME
-- Note: public schema ownership is managed by PostgreSQL
-- We only set grants here
-- ============================================================

--changeset dba:${SAFE_DB}-public-schema-001 runOnChange:true
GRANT USAGE ON SCHEMA public TO
    ${SAFE_DB}_owner_role,
    ${SAFE_DB}_app_rw_role,
    ${SAFE_DB}_report_ro_role;

-- Grant on existing objects
GRANT ALL ON ALL TABLES IN SCHEMA public TO ${SAFE_DB}_owner_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${SAFE_DB}_app_rw_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${SAFE_DB}_report_ro_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${SAFE_DB}_owner_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${SAFE_DB}_app_rw_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${SAFE_DB}_report_ro_role;

-- ── DEFAULT PRIVILEGES — future objects auto-granted ─────────

ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA public
    GRANT ALL ON TABLES TO ${SAFE_DB}_owner_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${SAFE_DB}_app_rw_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA public
    GRANT SELECT ON TABLES TO ${SAFE_DB}_report_ro_role;

ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA public
    GRANT ALL ON SEQUENCES TO ${SAFE_DB}_owner_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO ${SAFE_DB}_app_rw_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO ${SAFE_DB}_report_ro_role;

ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO ${SAFE_DB}_owner_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO ${SAFE_DB}_app_rw_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO ${SAFE_DB}_report_ro_role;

--rollback REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${SAFE_DB}_owner_role;
EOF
        else
            # Custom schema — full ownership
            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/002-schema.sql << EOF
--liquibase formatted sql

-- ============================================================
-- $SCHEMA/002-schema.sql — $DB_NAME
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-schema-001 runOnChange:true
CREATE SCHEMA IF NOT EXISTS $SCHEMA;

ALTER SCHEMA $SCHEMA OWNER TO ${SAFE_DB}_owner_role;

GRANT USAGE ON SCHEMA $SCHEMA TO
    ${SAFE_DB}_owner_role,
    ${SAFE_DB}_app_rw_role,
    ${SAFE_DB}_report_ro_role;

REVOKE ALL ON SCHEMA $SCHEMA FROM PUBLIC;

-- Grant on existing objects
GRANT ALL ON ALL TABLES IN SCHEMA $SCHEMA TO ${SAFE_DB}_owner_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA $SCHEMA TO ${SAFE_DB}_app_rw_role;
GRANT SELECT ON ALL TABLES IN SCHEMA $SCHEMA TO ${SAFE_DB}_report_ro_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA $SCHEMA TO ${SAFE_DB}_owner_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA $SCHEMA TO ${SAFE_DB}_app_rw_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA $SCHEMA TO ${SAFE_DB}_report_ro_role;

-- ── DEFAULT PRIVILEGES — future objects auto-granted ─────────

ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA $SCHEMA
    GRANT ALL ON TABLES TO ${SAFE_DB}_owner_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA $SCHEMA
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${SAFE_DB}_app_rw_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA $SCHEMA
    GRANT SELECT ON TABLES TO ${SAFE_DB}_report_ro_role;

ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA $SCHEMA
    GRANT ALL ON SEQUENCES TO ${SAFE_DB}_owner_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA $SCHEMA
    GRANT USAGE, SELECT ON SEQUENCES TO ${SAFE_DB}_app_rw_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA $SCHEMA
    GRANT USAGE, SELECT ON SEQUENCES TO ${SAFE_DB}_report_ro_role;

ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA $SCHEMA
    GRANT ALL ON FUNCTIONS TO ${SAFE_DB}_owner_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA $SCHEMA
    GRANT EXECUTE ON FUNCTIONS TO ${SAFE_DB}_app_rw_role;
ALTER DEFAULT PRIVILEGES FOR ROLE ${SAFE_DB}_owner_role IN SCHEMA $SCHEMA
    GRANT EXECUTE ON FUNCTIONS TO ${SAFE_DB}_report_ro_role;

--rollback DROP SCHEMA IF EXISTS $SCHEMA CASCADE;
EOF
        fi

        # ── 003-tables.sql — extract from live DB ──────────────
        echo "     Extracting tables..."

        TABLES=$(run_psql "$DB_NAME" \
            "SELECT table_name FROM information_schema.tables
             WHERE table_schema = '$SCHEMA'
             AND table_type = 'BASE TABLE'
             ORDER BY table_name;")

        cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/003-tables.sql << EOF
--liquibase formatted sql

-- ============================================================
-- $SCHEMA/003-tables.sql — $DB_NAME
-- Existing tables wrapped in IF NOT EXISTS
-- SET LOCAL ROLE = tables auto-owned by ${SAFE_DB}_owner_role
-- ADD NEW TABLES at the bottom following same pattern
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-tables runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

    SET LOCAL ROLE ${SAFE_DB}_owner_role;

EOF

        while IFS= read -r TABLE; do
            TABLE=$(echo "$TABLE" | xargs)
            [ -z "$TABLE" ] && continue
            echo "       + $TABLE"

            # Get columns
            COLS=$(run_psql "$DB_NAME" \
                "SELECT
                    '            ' || column_name || ' ' ||
                    CASE
                        WHEN data_type = 'character varying' THEN 'VARCHAR(' || COALESCE(character_maximum_length::text,'255') || ')'
                        WHEN data_type = 'character' THEN 'CHAR(' || COALESCE(character_maximum_length::text,'1') || ')'
                        WHEN data_type = 'numeric' THEN 'NUMERIC(' || COALESCE(numeric_precision::text,'10') || ',' || COALESCE(numeric_scale::text,'2') || ')'
                        WHEN data_type = 'integer' THEN 'INT'
                        WHEN data_type = 'bigint' THEN 'BIGINT'
                        WHEN data_type = 'smallint' THEN 'SMALLINT'
                        WHEN data_type = 'boolean' THEN 'BOOLEAN'
                        WHEN data_type = 'text' THEN 'TEXT'
                        WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
                        WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
                        WHEN data_type = 'date' THEN 'DATE'
                        WHEN data_type = 'time without time zone' THEN 'TIME'
                        WHEN data_type = 'json' THEN 'JSON'
                        WHEN data_type = 'jsonb' THEN 'JSONB'
                        WHEN data_type = 'uuid' THEN 'UUID'
                        WHEN data_type = 'ARRAY' THEN 'TEXT[]'
                        WHEN data_type = 'double precision' THEN 'DOUBLE PRECISION'
                        WHEN data_type = 'real' THEN 'REAL'
                        ELSE UPPER(data_type)
                    END ||
                    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
                    CASE WHEN column_default IS NOT NULL
                         THEN ' DEFAULT ' || column_default
                         ELSE '' END
                FROM information_schema.columns
                WHERE table_schema = '$SCHEMA' AND table_name = '$TABLE'
                ORDER BY ordinal_position;")

            # Format columns with commas
            FORMATTED_COLS=$(echo "$COLS" | awk 'NR>1{print prev","} {prev=$0} END{print prev}')

            cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/003-tables.sql << EOF
    -- ── $TABLE ─────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = '$SCHEMA' AND tablename = '$TABLE'
    ) THEN
        CREATE TABLE $SCHEMA.$TABLE (
$FORMATTED_COLS
        );
        RAISE NOTICE 'Created table: $TABLE';
    ELSE
        RAISE NOTICE 'Skipped: $TABLE (already exists)';
    END IF;

EOF
        done <<< "$TABLES"

        cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/003-tables.sql << EOF
    -- ──────────────────────────────────────────────────────────
    -- ADD NEW TABLES BELOW — ownership auto-applied ✅
    --
    -- IF NOT EXISTS (
    --     SELECT FROM pg_tables
    --     WHERE schemaname = '$SCHEMA' AND tablename = 'your_table'
    -- ) THEN
    --     CREATE TABLE $SCHEMA.your_table (
    --         id         SERIAL PRIMARY KEY,
    --         name       VARCHAR(100) NOT NULL,
    --         created_at TIMESTAMP DEFAULT NOW(),
    --         updated_at TIMESTAMP DEFAULT NOW()
    --     );
    --     RAISE NOTICE 'Created table: your_table';
    -- ELSE
    --     RAISE NOTICE 'Skipped: your_table (already exists)';
    -- END IF;
    -- ──────────────────────────────────────────────────────────

END
\$\$
\$\$END

--rollback SELECT 'manual rollback required for existing tables';
EOF

        # ── 004-indexes.sql ────────────────────────────────────
        echo "     Extracting indexes..."

        cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/004-indexes.sql << EOF
--liquibase formatted sql

-- ============================================================
-- $SCHEMA/004-indexes.sql — $DB_NAME
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-indexes runOnChange:true

EOF
        INDEXES=$(run_psql "$DB_NAME" \
            "SELECT indexdef FROM pg_indexes
             WHERE schemaname = '$SCHEMA'
             AND indexname NOT LIKE '%_pkey'
             ORDER BY indexname;")

        if [ -n "$INDEXES" ]; then
            while IFS= read -r IDX; do
                IDX=$(echo "$IDX" | xargs)
                [ -z "$IDX" ] && continue
                SAFE_IDX=$(echo "$IDX" \
                    | sed 's/CREATE INDEX /CREATE INDEX IF NOT EXISTS /g' \
                    | sed 's/CREATE UNIQUE INDEX /CREATE UNIQUE INDEX IF NOT EXISTS /g')
                echo "${SAFE_IDX};" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-indexes.sql
                echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-indexes.sql
            done <<< "$INDEXES"
        else
            echo "-- No custom indexes found in $SCHEMA" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-indexes.sql
        fi

        echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-indexes.sql
        echo "-- ADD NEW INDEXES BELOW" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-indexes.sql
        echo "-- CREATE INDEX IF NOT EXISTS idx_table_col ON $SCHEMA.table(col);" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-indexes.sql
        echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-indexes.sql
        echo "--rollback SELECT 'manual rollback required for existing indexes';" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-indexes.sql

        # ── 005-functions.sql ──────────────────────────────────
        echo "     Extracting functions..."

        cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/005-functions.sql << EOF
--liquibase formatted sql

-- ============================================================
-- $SCHEMA/005-functions.sql — $DB_NAME
-- ============================================================

EOF
        FUNCTIONS=$(run_psql "$DB_NAME" \
            "SELECT DISTINCT routine_name
             FROM information_schema.routines
             WHERE routine_schema = '$SCHEMA'
             AND routine_type = 'FUNCTION'
             ORDER BY routine_name;")

        if [ -n "$FUNCTIONS" ]; then
            while IFS= read -r FUNC; do
                FUNC=$(echo "$FUNC" | xargs)
                [ -z "$FUNC" ] && continue
                echo "       + function: $FUNC"
                FUNCDEF=$(run_psql "$DB_NAME" \
                    "SELECT pg_get_functiondef(oid)
                     FROM pg_proc
                     WHERE proname = '$FUNC'
                     AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = '$SCHEMA')
                     LIMIT 1;")
                if [ -n "$FUNCDEF" ]; then
                    cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-functions.sql << EOF
--changeset dba:${SAFE_DB}-${SAFE_SCH}-func-${FUNC} runOnChange:true endDelimiter:\$\$END
$FUNCDEF
\$\$END

EOF
                fi
            done <<< "$FUNCTIONS"
        else
            echo "-- No functions found in $SCHEMA" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-functions.sql
        fi

        echo "  ✅ Schema $SCHEMA done"
    done

    # ── 006-users.sql — one per database ─────────────────────
    FIRST_SCH=$(echo $SCHEMAS_WITH_TABLES | awk '{print $1}')
    cat > $REPO/databases/$DB_NAME/modules/$FIRST_SCH/006-users.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 006-users.sql — $DB_NAME
-- Passwords from GitHub Secrets via liquibase.properties
-- ============================================================

--changeset dba:${SAFE_DB}-users-001 runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${SAFE_DB}_owner') THEN
        CREATE USER ${SAFE_DB}_owner WITH PASSWORD '\${${SAFE_DB^^}_OWNER_PASSWORD}' NOINHERIT;
        RAISE NOTICE 'Created user: ${SAFE_DB}_owner';
    ELSE
        RAISE NOTICE 'Skipped: ${SAFE_DB}_owner (exists)';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${SAFE_DB}_app_user') THEN
        CREATE USER ${SAFE_DB}_app_user WITH PASSWORD '\${${SAFE_DB^^}_APP_PASSWORD}' NOINHERIT;
        RAISE NOTICE 'Created user: ${SAFE_DB}_app_user';
    ELSE
        RAISE NOTICE 'Skipped: ${SAFE_DB}_app_user (exists)';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${SAFE_DB}_report') THEN
        CREATE USER ${SAFE_DB}_report WITH PASSWORD '\${${SAFE_DB^^}_REPORT_PASSWORD}' NOINHERIT;
        RAISE NOTICE 'Created user: ${SAFE_DB}_report';
    ELSE
        RAISE NOTICE 'Skipped: ${SAFE_DB}_report (exists)';
    END IF;

END
\$\$
\$\$END

--changeset dba:${SAFE_DB}-users-002 runOnChange:true
GRANT ${SAFE_DB}_owner_role     TO ${SAFE_DB}_owner;
GRANT ${SAFE_DB}_app_rw_role    TO ${SAFE_DB}_app_user;
GRANT ${SAFE_DB}_report_ro_role TO ${SAFE_DB}_report;

GRANT CONNECT ON DATABASE "$DB_NAME" TO
    ${SAFE_DB}_owner,
    ${SAFE_DB}_app_user,
    ${SAFE_DB}_report;

--rollback DROP USER IF EXISTS ${SAFE_DB}_owner;
--rollback DROP USER IF EXISTS ${SAFE_DB}_app_user;
--rollback DROP USER IF EXISTS ${SAFE_DB}_report;
EOF

    # ── Close changelog-root.xml ──────────────────────────────
    echo "</databaseChangeLog>" >> $REPO/databases/$DB_NAME/changelog-root.xml

    # ── Mark all existing as already applied ──────────────────
    echo ""
    echo "  Running changelog-sync for $DB_NAME..."
    cd $REPO/databases/$DB_NAME

    liquibase \
        --url="jdbc:postgresql://$DB_HOST:$DB_PORT/$DB_NAME" \
        --username=$DB_USER \
        --search-path="$(pwd)" \
        --changeLogFile="changelog-root.xml" \
        changelog-sync 2>&1 | tail -5

    echo "  ✅ $DB_NAME fully migrated!"
    cd $REPO

done

# ── Final summary ─────────────────────────────────────────────
echo ""
echo "============================================"
echo " ✅ Migration Complete!"
echo ""
echo " Next steps:"
echo ""
echo " 1. Review generated files:"
echo "    ls databases/"
echo ""
echo " 2. Add secrets to GitHub for each DB:"
echo "    ACX_OWNER_PASSWORD, ACX_APP_PASSWORD, ACX_REPORT_PASSWORD"
echo "    ADHKI_MESSAGING_OWNER_PASSWORD ... etc"
echo ""
echo " 3. Update run.yaml — add all password params"
echo ""
echo " 4. Commit and push:"
echo "    git add databases/"
echo "    git commit -m 'feat: migrate all existing DBs to liquibase'"
echo "    git push origin development"
echo "============================================"

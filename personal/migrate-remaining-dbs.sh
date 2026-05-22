#!/bin/bash
# ============================================================
# migrate-prod-to-repo.sh
# Copies EXACT PROD structure into Git repo
# Extracts EVERYTHING:
#   roles, users, grants, schemas, enums/types,
#   tables + DDL, views, indexes, functions, procedures
# ============================================================

# ── CONFIG — update these ────────────────────────────────────
PROD_HOST="pgsql_cluster.adhkiapps.com"       
DB_PORT="5001"
DB_USER="postgres"
export PGPASSWORD="postgres"
REPO="$HOME/liquibase-CI-CD"

# ── Only these remaining databases ───────────────────────────
DATABASES=(
    "z_messagereports"
    "z_messagestore"
    "z_v2"
    "z_voffice"
    "zz_widgets"
    "zzz_billing"
)

# ── Override DB_HOST to point to PROD ────────────────────────
DB_HOST="$PROD_HOST"
# ─────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────

safe_name() { echo "$1" | tr '-' '_'; }

run_psql() {
    local DB=$1
    local QUERY=$2
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d "$DB" -t -A -c "$QUERY" 2>/dev/null
}

echo "============================================"
echo " Liquibase Migration — Copy Exact Structure"
echo " Host : $DB_HOST"
echo " DBs  : ${#DATABASES[@]}"
echo "============================================"

for DB_NAME in "${DATABASES[@]}"; do

    SAFE_DB=$(safe_name "$DB_NAME")

    echo ""
    echo "──────────────────────────────────────────"
    echo " Processing: $DB_NAME"
    echo "──────────────────────────────────────────"

    # ── Check connectivity ────────────────────────────────────
    if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d "$DB_NAME" -c "\q" 2>/dev/null; then
        echo "  ⚠️  Cannot connect to $DB_NAME — skipping"
        continue
    fi

    # ── Discover schemas with tables ─────────────────────────
    SCHEMAS=$(run_psql "$DB_NAME" \
        "SELECT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_toast','pg_catalog','information_schema')
         AND schema_name NOT LIKE 'pg_%'
         ORDER BY CASE WHEN schema_name='public' THEN 1 ELSE 0 END, schema_name;")

    SCHEMAS_WITH_OBJECTS=""
    while IFS= read -r SCH; do
        SCH=$(echo "$SCH" | xargs); [ -z "$SCH" ] && continue
        CNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema='$SCH' AND table_type='BASE TABLE';")
        VCNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM information_schema.views
             WHERE table_schema='$SCH';")
        TOTAL=$((${CNT:-0} + ${VCNT:-0}))
        if [ "$TOTAL" -gt 0 ]; then
            SCHEMAS_WITH_OBJECTS="$SCHEMAS_WITH_OBJECTS $SCH"
            echo "  Schema: $SCH (tables:${CNT} views:${VCNT})"
        fi
    done <<< "$SCHEMAS"

    [ -z "$SCHEMAS_WITH_OBJECTS" ] && echo "  ⚠️  No objects found — skipping" && continue

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
    <!-- Generated : $(date) -->
    <!-- NOTE: This is copied from existing DB — not new format -->

EOF

    IS_FIRST=true

    for SCHEMA in $SCHEMAS_WITH_OBJECTS; do
        SCHEMA=$(echo "$SCHEMA" | xargs); [ -z "$SCHEMA" ] && continue
        SAFE_SCH=$(safe_name "$SCHEMA")

        echo ""
        echo "  → Schema: $SCHEMA"

        mkdir -p $REPO/databases/$DB_NAME/modules/$SCHEMA

        # ── Decide which files to include based on what exists ─

        # Check roles exist in this DB
        ROLE_COUNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM pg_roles
             WHERE rolname NOT LIKE 'pg_%'
             AND rolname NOT IN ('postgres','replication','monitor');")

        # Check users (login roles) exist
        USER_COUNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM pg_roles
             WHERE rolcanlogin = true
             AND rolname NOT IN ('postgres','replication','monitor')
             AND rolname NOT LIKE 'pg_%';")

        # Check tables
        TABLE_COUNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema='$SCHEMA' AND table_type='BASE TABLE';")

        # Check views
        VIEW_COUNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM information_schema.views
             WHERE table_schema='$SCHEMA';")

        # Check indexes
        INDEX_COUNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM pg_indexes
             WHERE schemaname='$SCHEMA' AND indexname NOT LIKE '%_pkey';")

        # Check functions
        FUNC_COUNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM information_schema.routines
             WHERE routine_schema='$SCHEMA' AND routine_type='FUNCTION';")

        # Check procedures
        PROC_COUNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM information_schema.routines
             WHERE routine_schema='$SCHEMA' AND routine_type='PROCEDURE';")

        echo "     roles:${ROLE_COUNT} users:${USER_COUNT} tables:${TABLE_COUNT} views:${VIEW_COUNT} indexes:${INDEX_COUNT} functions:${FUNC_COUNT} procedures:${PROC_COUNT}"

        # ── Add only files that have content ──────────────────
        echo "" >> $REPO/databases/$DB_NAME/changelog-root.xml
        echo "    <!-- ── $SCHEMA ── -->" >> $REPO/databases/$DB_NAME/changelog-root.xml

        # 001-roles.sql — only if roles exist
        if [ "${ROLE_COUNT:-0}" -gt 0 ] && [ "$IS_FIRST" = "true" ]; then
            echo "    <include file=\"modules/$SCHEMA/001-roles.sql\"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/001-roles.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 001-roles.sql — $DB_NAME
-- Copied from existing DB — exact current roles
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-roles-001 runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

EOF
            # Extract actual roles from DB
            ROLES=$(run_psql "$DB_NAME" \
                "SELECT rolname,
                        CASE WHEN rolsuper THEN 'SUPERUSER' ELSE '' END,
                        CASE WHEN rolcreatedb THEN 'CREATEDB' ELSE '' END,
                        CASE WHEN rolcreaterole THEN 'CREATEROLE' ELSE '' END,
                        CASE WHEN rolinherit THEN 'INHERIT' ELSE 'NOINHERIT' END,
                        CASE WHEN rolcanlogin THEN 'LOGIN' ELSE 'NOLOGIN' END,
                        CASE WHEN rolreplication THEN 'REPLICATION' ELSE '' END
                 FROM pg_roles
                 WHERE rolname NOT LIKE 'pg_%'
                 AND rolname NOT IN ('postgres','replication','monitor')
                 AND rolcanlogin = false
                 ORDER BY rolname;")

            while IFS='|' read -r RNAME RSUPER RCREATEDB RCREATEROLE RINHERIT RLOGIN RREPL; do
                RNAME=$(echo "$RNAME" | xargs); [ -z "$RNAME" ] && continue
                ATTRS=$(echo "$RSUPER $RCREATEDB $RCREATEROLE $RINHERIT $RLOGIN $RREPL" | xargs)
                # Quote name if it contains hyphens, dots, or special chars
                if echo "$RNAME" | grep -qE '[-.]'; then
                    QRNAME=\"$RNAME\"
                else
                    QRNAME=$RNAME
                fi
                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/001-roles.sql << EOF
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$RNAME') THEN
        CREATE ROLE $QRNAME $ATTRS;
        RAISE NOTICE 'Created role: $RNAME';
    ELSE
        RAISE NOTICE 'Skipped: $RNAME (already exists)';
    END IF;

EOF
            done <<< "$ROLES"

            # Extract role memberships
            # quote_ident auto-quotes names with hyphens/dots/special chars
            MEMBERSHIPS=$(run_psql "$DB_NAME" \
                "SELECT r.rolname, m.rolname
                 FROM pg_auth_members am
                 JOIN pg_roles r ON r.oid = am.roleid
                 JOIN pg_roles m ON m.oid = am.member
                 WHERE r.rolname NOT LIKE 'pg_%'
                 AND m.rolname NOT LIKE 'pg_%'
                 AND r.rolname NOT IN ('postgres')
                 AND m.rolname NOT IN ('postgres')
                 ORDER BY r.rolname, m.rolname;")

            if [ -n "$MEMBERSHIPS" ]; then
                echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/001-roles.sql
                echo "    -- Role memberships" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/001-roles.sql
                while IFS='|' read -r GROLE GMEMBER; do
                    GROLE=$(echo "$GROLE" | xargs); GMEMBER=$(echo "$GMEMBER" | xargs)
                    [ -z "$GROLE" ] || [ -z "$GMEMBER" ] && continue
                    if echo "$GROLE" | grep -qE '[^a-z0-9_]'; then QGROLE="\"$GROLE\""; else QGROLE="$GROLE"; fi
                    if echo "$GMEMBER" | grep -qE '[^a-z0-9_]'; then QGMEMBER="\"$GMEMBER\""; else QGMEMBER="$GMEMBER"; fi
                    echo "    EXECUTE \$q\$GRANT $QGROLE TO $QGMEMBER\$q\$;" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/001-roles.sql
                done <<< "$MEMBERSHIPS"
            fi

            cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/001-roles.sql << EOF

END
\$\$
\$\$END

--rollback SELECT 'manual rollback — check roles before dropping';
EOF
            echo "     ✅ 001-roles.sql (${ROLE_COUNT} roles)"
        fi

        # 002-users.sql — only if login users exist
        if [ "${USER_COUNT:-0}" -gt 0 ] && [ "$IS_FIRST" = "true" ]; then
            echo "    <include file=\"modules/$SCHEMA/002-users.sql\"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/002-users.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 002-users.sql — $DB_NAME
-- Copied from existing DB — exact current users + grants
-- NOTE: Passwords set to placeholder — update in GitHub Secrets
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-users-001 runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

EOF
            # Extract actual login users
            USERS=$(run_psql "$DB_NAME" \
                "SELECT rolname,
                        CASE WHEN rolinherit THEN 'INHERIT' ELSE 'NOINHERIT' END,
                        CASE WHEN rolsuper THEN 'SUPERUSER' ELSE '' END,
                        CASE WHEN rolcreatedb THEN 'CREATEDB' ELSE '' END,
                        CASE WHEN rolcreaterole THEN 'CREATEROLE' ELSE '' END
                 FROM pg_roles
                 WHERE rolcanlogin = true
                 AND rolname NOT IN ('postgres','replication','monitor')
                 AND rolname NOT LIKE 'pg_%'
                 ORDER BY rolname;")

            while IFS='|' read -r UNAME UINHERIT USUPER UCREATEDB UCREATEROLE; do
                UNAME=$(echo "$UNAME" | xargs); [ -z "$UNAME" ] && continue
                UATTRS=$(echo "$UINHERIT $USUPER $UCREATEDB $UCREATEROLE" | xargs)
                UUPPER=$(echo "${UNAME^^}" | tr '-' '_' | tr '.' '_')
                # Quote name if it contains hyphens, dots, or special chars
                if echo "$UNAME" | grep -qE '[-.]'; then
                    QUNAME=\"$UNAME\"
                else
                    QUNAME=$UNAME
                fi
                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/002-users.sql << EOF
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$UNAME') THEN
        CREATE USER $QUNAME WITH PASSWORD '\${${UUPPER}_PASSWORD}' $UATTRS;
        RAISE NOTICE 'Created user: $UNAME';
    ELSE
        RAISE NOTICE 'Skipped: $UNAME (already exists)';
    END IF;

EOF
            done <<< "$USERS"

            cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/002-users.sql << EOF
END
\$\$
\$\$END

-- ── Exact grants copied from DB ───────────────────────────────
--changeset dba:${SAFE_DB}-${SAFE_SCH}-grants-001 runOnChange:true
EOF

            # Extract DB-level grants
            DB_GRANTS=$(run_psql "$DB_NAME" \
                "SELECT 'GRANT ' || privilege_type || ' ON DATABASE \"$DB_NAME\" TO ' || grantee || ';'
                 FROM information_schema.role_table_grants
                 WHERE table_catalog = '$DB_NAME'
                 UNION
                 SELECT 'GRANT CONNECT ON DATABASE \"$DB_NAME\" TO ' || r.rolname || ';'
                 FROM pg_roles r
                 WHERE r.rolcanlogin = true
                 AND r.rolname NOT IN ('postgres')
                 AND r.rolname NOT LIKE 'pg_%'
                 AND has_database_privilege(r.rolname, '$DB_NAME', 'CONNECT');")

            echo "$DB_GRANTS" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/002-users.sql
            echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/002-users.sql
            echo "--rollback SELECT 'manual rollback — check users before dropping';" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/002-users.sql

            echo "     ✅ 002-users.sql (${USER_COUNT} users)"
        fi

        # 003-schema.sql — always
        echo "    <include file=\"modules/$SCHEMA/003-schema.sql\"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

        cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/003-schema.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 003-schema.sql — $DB_NAME / $SCHEMA
-- Copied exact schema grants from DB
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-schema-001 runOnChange:true
CREATE SCHEMA IF NOT EXISTS $SCHEMA;

EOF
        # Extract exact schema ACL
        SCHEMA_GRANTS=$(run_psql "$DB_NAME" \
            "SELECT 'GRANT ' || privilege_type || ' ON SCHEMA $SCHEMA TO ' || grantee || ';'
             FROM information_schema.usage_privileges
             WHERE object_schema = '$SCHEMA'
             AND object_type = 'SCHEMA'
             AND grantee NOT IN ('postgres','PUBLIC')
             AND grantee NOT LIKE 'pg_%';")
        [ -n "$SCHEMA_GRANTS" ] && echo "$SCHEMA_GRANTS" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/003-schema.sql

        echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/003-schema.sql
        echo "--rollback DROP SCHEMA IF EXISTS $SCHEMA CASCADE;" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/003-schema.sql
        echo "     ✅ 003-schema.sql"


        # Check enums/types
        ENUM_COUNT=$(run_psql "$DB_NAME" \
            "SELECT COUNT(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typtype = 'e' AND n.nspname = '$SCHEMA';")

        # 004-types.sql — only if enums/custom types exist
        if [ "${ENUM_COUNT:-0}" -gt 0 ]; then
            echo "    <include file="modules/$SCHEMA/004-types.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/004-types.sql << TYPESEOF
--liquibase formatted sql

-- ============================================================
-- 004-types.sql — $DB_NAME / $SCHEMA
-- Copied exact ENUM and custom TYPE definitions from DB
-- MUST run before tables — tables may reference these types
-- ============================================================

TYPESEOF

            ENUMS=$(run_psql "$DB_NAME" \
                "SELECT t.typname
                 FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typtype = 'e'
                 AND n.nspname = '$SCHEMA'
                 ORDER BY t.typname;")

            while IFS= read -r ENAME; do
                ENAME=$(echo "$ENAME" | xargs); [ -z "$ENAME" ] && continue
                echo "       + enum: $ENAME"

                # Get exact enum values in order
                ENUM_VALS=$(run_psql "$DB_NAME" \
                    "SELECT string_agg(quote_literal(enumlabel), ', ' ORDER BY enumsortorder)
                     FROM pg_enum e
                     JOIN pg_type t ON t.oid = e.enumtypid
                     JOIN pg_namespace n ON n.oid = t.typnamespace
                     WHERE t.typname = '$ENAME' AND n.nspname = '$SCHEMA';")

                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-types.sql << ENUMEOF
--changeset dba:${SAFE_DB}-${SAFE_SCH}-enum-${ENAME} runOnChange:false
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = '$ENAME' AND n.nspname = '$SCHEMA') THEN
        CREATE TYPE $SCHEMA.$ENAME AS ENUM ($ENUM_VALS);
        RAISE NOTICE 'Created enum: $ENAME';
    ELSE
        RAISE NOTICE 'Skipped: $ENAME (already exists)';
    END IF;
END
\$\$;

--rollback DROP TYPE IF EXISTS $SCHEMA.$ENAME;
ENUMEOF

            done <<< "$ENUMS"

            echo "     ✅ 004-types.sql (${ENUM_COUNT} enums)"
        fi
        # Check sequences
        SEQ_COUNT=$(run_psql "$DB_NAME"             "SELECT COUNT(*) FROM information_schema.sequences
             WHERE sequence_schema = '$SCHEMA';")

        # 004-sequences.sql — only if standalone sequences exist
        if [ "${SEQ_COUNT:-0}" -gt 0 ]; then
            echo "    <include file="modules/$SCHEMA/004-sequences.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/004-sequences.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 004-sequences.sql — $DB_NAME / $SCHEMA
-- Copied exact sequence definitions from DB
-- Placed BEFORE tables — tables may depend on these sequences
-- NOTE: SERIAL/BIGSERIAL columns auto-create sequences —
--       only standalone sequences are listed here
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-sequences runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

    SET LOCAL ROLE ${SAFE_DB}_owner_role;

EOF

            # Extract standalone sequences (not owned by a table column)
            SEQUENCES=$(run_psql "$DB_NAME"                 "SELECT
                    s.sequence_name,
                    s.data_type,
                    s.start_value,
                    s.minimum_value,
                    s.maximum_value,
                    s.increment,
                    s.cycle_option
                 FROM information_schema.sequences s
                 WHERE s.sequence_schema = '$SCHEMA'
                 AND NOT EXISTS (
                     SELECT 1 FROM pg_depend d
                     JOIN pg_class c ON c.oid = d.objid
                     JOIN pg_class t ON t.oid = d.refobjid
                     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
                     WHERE c.relkind = 'S'
                     AND c.relname = s.sequence_name
                     AND d.deptype = 'a'
                 )
                 ORDER BY s.sequence_name;")

            while IFS='|' read -r SNAME SDTYPE SSTART SMIN SMAX SINC SCYCLE; do
                SNAME=$(echo "$SNAME" | xargs); [ -z "$SNAME" ] && continue
                SCYCLE_CLAUSE=$([ "$SCYCLE" = "YES" ] && echo "CYCLE" || echo "NO CYCLE")
                echo "       + sequence: $SNAME"

                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-sequences.sql << EOF
    IF NOT EXISTS (
        SELECT FROM pg_sequences
        WHERE schemaname = '$SCHEMA' AND sequencename = '$SNAME'
    ) THEN
        CREATE SEQUENCE $SCHEMA.$SNAME
            AS $SDTYPE
            START WITH $SSTART
            INCREMENT BY $SINC
            MINVALUE $SMIN
            MAXVALUE $SMAX
            $SCYCLE_CLAUSE;
        RAISE NOTICE 'Created sequence: $SNAME';
    ELSE
        RAISE NOTICE 'Skipped: $SNAME (already exists)';
    END IF;

EOF
            done <<< "$SEQUENCES"

            cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-sequences.sql << EOF
END
\$\$
\$\$END

EOF

            # Extract sequence grants
            SEQ_GRANTS=$(run_psql "$DB_NAME"                 "SELECT
                    'GRANT ' || privilege_type ||
                    ' ON SEQUENCE ' || object_schema || '.' || object_name ||
                    ' TO ' || grantee || ';'
                 FROM information_schema.usage_privileges
                 WHERE object_schema = '$SCHEMA'
                 AND object_type = 'SEQUENCE'
                 AND grantee NOT IN ('postgres','PUBLIC')
                 AND grantee NOT LIKE 'pg_%'
                 ORDER BY object_name, grantee;")

            if [ -n "$SEQ_GRANTS" ]; then
                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-sequences.sql << EOF
-- ── Sequence grants — copied exact from DB ───────────────────
--changeset dba:${SAFE_DB}-${SAFE_SCH}-seq-grants runOnChange:true
$SEQ_GRANTS

EOF
            fi

            echo "--rollback SELECT 'manual rollback for sequences';" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/004-sequences.sql
            echo "     ✅ 004-sequences.sql (${SEQ_COUNT} sequences)"
        fi

        # 005-tables.sql — only if tables exist
        if [ "${TABLE_COUNT:-0}" -gt 0 ]; then
            echo "    <include file=\"modules/$SCHEMA/005-tables.sql\"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 005-tables.sql — $DB_NAME / $SCHEMA
-- Copied exact table structure from DB
-- ADD NEW TABLES at the bottom following same pattern
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-tables runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

    SET LOCAL ROLE SESSION_USER;

EOF
            TABLES=$(run_psql "$DB_NAME" \
                "SELECT table_name FROM information_schema.tables
                 WHERE table_schema='$SCHEMA' AND table_type='BASE TABLE'
                 ORDER BY table_name;")

            while IFS= read -r TBL; do
                TBL=$(echo "$TBL" | xargs); [ -z "$TBL" ] && continue
                echo "       + table: $TBL"

                # Get exact DDL using pg_dump (no-privileges — grants handled separately below)
                TBL_DDL=$(pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER \
                    -d "$DB_NAME" \
                    --schema="$SCHEMA" \
                    --table="$SCHEMA.$TBL" \
                    --schema-only \
                    --no-owner \
                    --no-privileges \
                    --no-comments \
                    2>/dev/null | grep -v "^--" | grep -v "^SET" | grep -v "^SELECT" | grep -v "^$" | grep -A1000 "CREATE TABLE")

                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql << EOF
    -- ── $TBL ─────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname='$SCHEMA' AND tablename='$TBL'
    ) THEN
$TBL_DDL
        RAISE NOTICE 'Created table: $TBL';
    ELSE
        RAISE NOTICE 'Skipped: $TBL (already exists)';
    END IF;

EOF
            done <<< "$TABLES"

            cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql << EOF
    -- ADD NEW TABLES BELOW ──────────────────────────────────

END
\$\$
\$\$END

--rollback SELECT 'manual rollback required';
EOF
            echo "     ✅ 005-tables.sql (${TABLE_COUNT} tables)"

            # ── Extract exact table-level grants from DB ───────
            TABLE_GRANTS=$(run_psql "$DB_NAME" \
                "SELECT 'GRANT ' || string_agg(privilege_type, ', ' ORDER BY privilege_type) || ' ON TABLE ' || table_schema || '.' || table_name || ' TO ' || grantee || ';' FROM information_schema.role_table_grants WHERE table_schema = '$SCHEMA' AND grantor != grantee AND grantee NOT IN ('postgres','PUBLIC') AND grantee NOT LIKE 'pg_%' GROUP BY table_schema, table_name, grantee ORDER BY table_name, grantee;")

            SEQ_GRANTS=$(run_psql "$DB_NAME" \
                "SELECT 'GRANT ' || privilege_type || ' ON SEQUENCE ' || object_schema || '.' || object_name || ' TO ' || grantee || ';' FROM information_schema.usage_privileges WHERE object_schema = '$SCHEMA' AND object_type = 'SEQUENCE' AND grantee NOT IN ('postgres','PUBLIC') AND grantee NOT LIKE 'pg_%' ORDER BY object_name, grantee;")

            if [ -n "$TABLE_GRANTS" ] || [ -n "$SEQ_GRANTS" ]; then
                printf "
-- Table & Sequence GRANTS — copied exact from DB
" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql
                printf -- "--changeset dba:${SAFE_DB}-${SAFE_SCH}-table-grants runOnChange:true
" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql
                [ -n "$TABLE_GRANTS" ] && echo "$TABLE_GRANTS" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql
                [ -n "$SEQ_GRANTS" ] && echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql && echo "-- Sequence grants" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql && echo "$SEQ_GRANTS" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql
                printf "
--rollback SELECT 'manual rollback for table grants';
" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/005-tables.sql
                GRANT_COUNT=$(echo "$TABLE_GRANTS" | grep -c "GRANT" 2>/dev/null || echo 0)
                echo "     ✅ Table grants: ${GRANT_COUNT} statements copied"
            else
                echo "     ℹ️  No table-level grants found in $SCHEMA"
            fi
        fi

        # 006-views.sql — only if views exist
        if [ "${VIEW_COUNT:-0}" -gt 0 ]; then
            echo "    <include file=\"modules/$SCHEMA/006-views.sql\"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/006-views.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 006-views.sql — $DB_NAME / $SCHEMA
-- Copied exact view definitions from DB
-- ============================================================

EOF
            VIEWS=$(run_psql "$DB_NAME" \
                "SELECT table_name FROM information_schema.views
                 WHERE table_schema='$SCHEMA'
                 ORDER BY table_name;")

            while IFS= read -r VW; do
                VW=$(echo "$VW" | xargs); [ -z "$VW" ] && continue
                echo "       + view: $VW"

                VIEW_DEF=$(run_psql "$DB_NAME" \
                    "SELECT 'CREATE OR REPLACE VIEW $SCHEMA.$VW AS ' || view_definition
                     FROM information_schema.views
                     WHERE table_schema='$SCHEMA' AND table_name='$VW';")

                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/006-views.sql << EOF
--changeset dba:${SAFE_DB}-${SAFE_SCH}-view-${VW} runOnChange:true
$VIEW_DEF

--rollback DROP VIEW IF EXISTS $SCHEMA.$VW;
EOF
            done <<< "$VIEWS"
            echo "     ✅ 006-views.sql (${VIEW_COUNT} views)"
        fi

        # 007-indexes.sql — only if indexes exist
        if [ "${INDEX_COUNT:-0}" -gt 0 ]; then
            echo "    <include file=\"modules/$SCHEMA/007-indexes.sql\"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/007-indexes.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 007-indexes.sql — $DB_NAME / $SCHEMA
-- Copied exact index definitions from DB
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-indexes runOnChange:true

EOF
            INDEXES=$(run_psql "$DB_NAME" \
                "SELECT indexdef FROM pg_indexes
                 WHERE schemaname='$SCHEMA'
                 AND indexname NOT LIKE '%_pkey'
                 ORDER BY indexname;")

            while IFS= read -r IDX; do
                IDX=$(echo "$IDX" | xargs); [ -z "$IDX" ] && continue
                SAFE_IDX=$(echo "$IDX" \
                    | sed 's/CREATE INDEX /CREATE INDEX IF NOT EXISTS /g' \
                    | sed 's/CREATE UNIQUE INDEX /CREATE UNIQUE INDEX IF NOT EXISTS /g')
                echo "${SAFE_IDX};" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/007-indexes.sql
                echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/007-indexes.sql
            done <<< "$INDEXES"

            echo "--rollback SELECT 'manual rollback for indexes';" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/007-indexes.sql
            echo "     ✅ 007-indexes.sql (${INDEX_COUNT} indexes)"
        fi

        # 008-functions.sql — only if functions exist
        if [ "${FUNC_COUNT:-0}" -gt 0 ]; then
            echo "    <include file=\"modules/$SCHEMA/008-functions.sql\"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/008-functions.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 008-functions.sql — $DB_NAME / $SCHEMA
-- Copied exact function definitions from DB
-- ============================================================

EOF
            FUNCS=$(run_psql "$DB_NAME" \
                "SELECT DISTINCT routine_name
                 FROM information_schema.routines
                 WHERE routine_schema='$SCHEMA'
                 AND routine_type='FUNCTION'
                 ORDER BY routine_name;")

            while IFS= read -r FN; do
                FN=$(echo "$FN" | xargs); [ -z "$FN" ] && continue
                echo "       + function: $FN"
                FNDEF=$(run_psql "$DB_NAME" \
                    "SELECT pg_get_functiondef(oid)
                     FROM pg_proc
                     WHERE proname='$FN'
                     AND prokind='f'
                     AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='$SCHEMA')
                     LIMIT 1;")
                if [ -n "$FNDEF" ]; then
                    cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/008-functions.sql << EOF
--changeset dba:${SAFE_DB}-${SAFE_SCH}-func-${FN} runOnChange:true endDelimiter:\$\$END
$FNDEF
\$\$END

--rollback DROP FUNCTION IF EXISTS $SCHEMA.$FN;
EOF
                fi
            done <<< "$FUNCS"
            echo "     ✅ 008-functions.sql (${FUNC_COUNT} functions)"
        fi

        # 009-procedures.sql — only if procedures exist
        if [ "${PROC_COUNT:-0}" -gt 0 ]; then
            echo "    <include file=\"modules/$SCHEMA/009-procedures.sql\"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/009-procedures.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 009-procedures.sql — $DB_NAME / $SCHEMA
-- Copied exact procedure definitions from DB
-- ============================================================

EOF
            PROCS=$(run_psql "$DB_NAME" \
                "SELECT DISTINCT routine_name
                 FROM information_schema.routines
                 WHERE routine_schema='$SCHEMA'
                 AND routine_type='PROCEDURE'
                 ORDER BY routine_name;")

            while IFS= read -r PR; do
                PR=$(echo "$PR" | xargs); [ -z "$PR" ] && continue
                echo "       + procedure: $PR"
                PRDEF=$(run_psql "$DB_NAME" \
                    "SELECT pg_get_functiondef(oid)
                     FROM pg_proc
                     WHERE proname='$PR'
                     AND prokind='p'
                     AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='$SCHEMA')
                     LIMIT 1;")
                if [ -n "$PRDEF" ]; then
                    cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/009-procedures.sql << EOF
--changeset dba:${SAFE_DB}-${SAFE_SCH}-proc-${PR} runOnChange:true endDelimiter:\$\$END
$PRDEF
\$\$END

--rollback DROP PROCEDURE IF EXISTS $SCHEMA.$PR;
EOF
                fi
            done <<< "$PROCS"
            echo "     ✅ 009-procedures.sql (${PROC_COUNT} procedures)"
        fi

        # ── 010-triggers.sql ───────────────────────────────────
        TRIG_COUNT=$(run_psql "$DB_NAME"             "SELECT COUNT(*) FROM information_schema.triggers
             WHERE trigger_schema = '$SCHEMA';")

        if [ "${TRIG_COUNT:-0}" -gt 0 ]; then
            echo "    <include file="modules/$SCHEMA/010-triggers.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/010-triggers.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 010-triggers.sql — $DB_NAME / $SCHEMA
-- Copied exact trigger definitions from DB
-- ============================================================

EOF
            TRIGGERS=$(run_psql "$DB_NAME"                 "SELECT DISTINCT
                    trigger_name,
                    event_object_table,
                    action_timing,
                    string_agg(event_manipulation, ' OR ' ORDER BY event_manipulation),
                    action_orientation,
                    action_statement
                 FROM information_schema.triggers
                 WHERE trigger_schema = '$SCHEMA'
                 GROUP BY trigger_name, event_object_table,
                          action_timing, action_orientation, action_statement
                 ORDER BY event_object_table, trigger_name;")

            while IFS='|' read -r TNAME TTABLE TTIMING TEVENTS TORIENT TSTMT; do
                TNAME=$(echo "$TNAME" | xargs); [ -z "$TNAME" ] && continue
                TTABLE=$(echo "$TTABLE" | xargs)
                TTIMING=$(echo "$TTIMING" | xargs)
                TEVENTS=$(echo "$TEVENTS" | xargs)
                TORIENT=$([ "$TORIENT" = "ROW" ] && echo "FOR EACH ROW" || echo "FOR EACH STATEMENT")
                TSTMT=$(echo "$TSTMT" | xargs)
                echo "       + trigger: $TNAME on $TTABLE"

                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/010-triggers.sql << EOF
--changeset dba:${SAFE_DB}-${SAFE_SCH}-trig-${TNAME}-${TTABLE} runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname = '$TNAME'
        AND c.relname = '$TTABLE'
        AND n.nspname = '$SCHEMA'
    ) THEN
        CREATE TRIGGER $TNAME
            $TTIMING $TEVENTS
            ON $SCHEMA.$TTABLE
            $TORIENT
            $TSTMT;
        RAISE NOTICE 'Created trigger: $TNAME on $TTABLE';
    ELSE
        RAISE NOTICE 'Skipped: $TNAME on $TTABLE (already exists)';
    END IF;
END
\$\$
\$\$END

--rollback DROP TRIGGER IF EXISTS $TNAME ON $SCHEMA.$TTABLE;
EOF
            done <<< "$TRIGGERS"
            echo "     ✅ 010-triggers.sql (${TRIG_COUNT} triggers)"
        fi

        # ── 011-materialized-views.sql ─────────────────────────
        MVIEW_COUNT=$(run_psql "$DB_NAME"             "SELECT COUNT(*) FROM pg_matviews
             WHERE schemaname = '$SCHEMA';")

        if [ "${MVIEW_COUNT:-0}" -gt 0 ]; then
            echo "    <include file="modules/$SCHEMA/011-matviews.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/011-matviews.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 011-matviews.sql — $DB_NAME / $SCHEMA
-- Copied exact materialized view definitions from DB
-- ============================================================

EOF
            MVIEWS=$(run_psql "$DB_NAME"                 "SELECT matviewname, definition
                 FROM pg_matviews
                 WHERE schemaname = '$SCHEMA'
                 ORDER BY matviewname;")

            while IFS='|' read -r MVNAME MVDEF; do
                MVNAME=$(echo "$MVNAME" | xargs); [ -z "$MVNAME" ] && continue
                MVDEF=$(echo "$MVDEF" | xargs)
                echo "       + matview: $MVNAME"
                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/011-matviews.sql << EOF
--changeset dba:${SAFE_DB}-${SAFE_SCH}-matview-${MVNAME} runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_matviews
        WHERE schemaname = '$SCHEMA' AND matviewname = '$MVNAME'
    ) THEN
        CREATE MATERIALIZED VIEW $SCHEMA.$MVNAME AS
        $MVDEF
        WITH DATA;
        RAISE NOTICE 'Created materialized view: $MVNAME';
    ELSE
        RAISE NOTICE 'Skipped: $MVNAME (already exists)';
    END IF;
END
\$\$
\$\$END

--rollback DROP MATERIALIZED VIEW IF EXISTS $SCHEMA.$MVNAME;
EOF
            done <<< "$MVIEWS"
            echo "     ✅ 011-matviews.sql (${MVIEW_COUNT} materialized views)"
        fi

        # ── 012-rules.sql ──────────────────────────────────────
        RULE_COUNT=$(run_psql "$DB_NAME"             "SELECT COUNT(*) FROM pg_rules
             WHERE schemaname = '$SCHEMA'
             AND rulename != '_RETURN';")

        if [ "${RULE_COUNT:-0}" -gt 0 ]; then
            echo "    <include file="modules/$SCHEMA/012-rules.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/012-rules.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 012-rules.sql — $DB_NAME / $SCHEMA
-- Copied exact rule definitions from DB
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-rules runOnChange:true
EOF
            RULES=$(run_psql "$DB_NAME"                 "SELECT definition
                 FROM pg_rules
                 WHERE schemaname = '$SCHEMA'
                 AND rulename != '_RETURN'
                 ORDER BY tablename, rulename;")

            while IFS= read -r RULEDEF; do
                RULEDEF=$(echo "$RULEDEF" | xargs); [ -z "$RULEDEF" ] && continue
                echo "${RULEDEF};" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/012-rules.sql
                echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/012-rules.sql
            done <<< "$RULES"

            echo "--rollback SELECT 'manual rollback for rules';" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/012-rules.sql
            echo "     ✅ 012-rules.sql (${RULE_COUNT} rules)"
        fi

        # ── 013-composite-types.sql ────────────────────────────
        if [ "${COMP_COUNT:-0}" -gt 0 ]; then
            echo "    <include file="modules/$SCHEMA/013-composite-types.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/013-composite-types.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 013-composite-types.sql — $DB_NAME / $SCHEMA
-- Copied exact composite type definitions from DB
-- ============================================================

EOF
            COMP_TYPES=$(run_psql "$DB_NAME"                 "SELECT
                    t.typname,
                    string_agg(a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod), ', ' ORDER BY a.attnum)
                 FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 JOIN pg_attribute a ON a.attrelid = t.typrelid
                 WHERE t.typtype = 'c'
                 AND n.nspname = '$SCHEMA'
                 AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.reltype = t.oid)
                 GROUP BY t.typname
                 ORDER BY t.typname;")

            while IFS='|' read -r CTNAME CTCOLS; do
                CTNAME=$(echo "$CTNAME" | xargs); [ -z "$CTNAME" ] && continue
                echo "       + composite type: $CTNAME"
                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/013-composite-types.sql << EOF
--changeset dba:${SAFE_DB}-${SAFE_SCH}-ctype-${CTNAME} runOnChange:false endDelimiter:\$\$END
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = '$CTNAME' AND n.nspname = '$SCHEMA'
    ) THEN
        CREATE TYPE $SCHEMA.$CTNAME AS ($CTCOLS);
        RAISE NOTICE 'Created composite type: $CTNAME';
    ELSE
        RAISE NOTICE 'Skipped: $CTNAME (already exists)';
    END IF;
END
\$\$
\$\$END

--rollback DROP TYPE IF EXISTS $SCHEMA.$CTNAME;
EOF
            done <<< "$COMP_TYPES"
            echo "     ✅ 013-composite-types.sql (${COMP_COUNT} types)"
        fi

        # ── 014-rls-policies.sql ───────────────────────────────
        if [ "${RLS_COUNT:-0}" -gt 0 ]; then
            echo "    <include file="modules/$SCHEMA/014-rls-policies.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/014-rls-policies.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 014-rls-policies.sql — $DB_NAME / $SCHEMA
-- Row Level Security policies copied exact from DB
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-rls runOnChange:true
EOF
            # Enable RLS on tables that have it
            RLS_TABLES=$(run_psql "$DB_NAME"                 "SELECT c.relname
                 FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE c.relrowsecurity = true
                 AND n.nspname = '$SCHEMA'
                 ORDER BY c.relname;")

            while IFS= read -r RTBL; do
                RTBL=$(echo "$RTBL" | xargs); [ -z "$RTBL" ] && continue
                echo "ALTER TABLE $SCHEMA.$RTBL ENABLE ROW LEVEL SECURITY;" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/014-rls-policies.sql
            done <<< "$RLS_TABLES"

            echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/014-rls-policies.sql

            # Policies
            POLICIES=$(run_psql "$DB_NAME"                 "SELECT
                    policyname,
                    tablename,
                    cmd,
                    roles::text,
                    COALESCE(qual, 'NULL'),
                    COALESCE(with_check, 'NULL')
                 FROM pg_policies
                 WHERE schemaname = '$SCHEMA'
                 ORDER BY tablename, policyname;")

            while IFS='|' read -r PNAME PTABLE PCMD PROLES PUSING PCHECK; do
                PNAME=$(echo "$PNAME" | xargs); [ -z "$PNAME" ] && continue
                PCMD=$(echo "$PCMD" | xargs)
                PROLES=$(echo "$PROLES" | xargs)
                PUSING=$(echo "$PUSING" | xargs)
                PCHECK=$(echo "$PCHECK" | xargs)
                CMD_CLAUSE=$([ "$PCMD" = "*" ] && echo "ALL" || echo "$PCMD")
                TO_CLAUSE=$([ -n "$PROLES" ] && [ "$PROLES" != "{}" ] && echo "TO $PROLES" || echo "")
                USING_CLAUSE=$([ "$PUSING" != "NULL" ] && echo "USING ($PUSING)" || echo "")
                CHECK_CLAUSE=$([ "$PCHECK" != "NULL" ] && echo "WITH CHECK ($PCHECK)" || echo "")
                echo "       + RLS policy: $PNAME on $PTABLE"
                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/014-rls-policies.sql << EOF
DROP POLICY IF EXISTS $PNAME ON $SCHEMA.$PTABLE;
CREATE POLICY $PNAME ON $SCHEMA.$PTABLE
    FOR $CMD_CLAUSE $TO_CLAUSE
    $USING_CLAUSE
    $CHECK_CLAUSE;
EOF
            done <<< "$POLICIES"

            echo "" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/014-rls-policies.sql
            echo "--rollback SELECT 'manual rollback for RLS policies';" >> $REPO/databases/$DB_NAME/modules/$SCHEMA/014-rls-policies.sql
            echo "     ✅ 014-rls-policies.sql (${RLS_COUNT} policies)"
        fi

        # ── 015-foreign-tables.sql ─────────────────────────────
        if [ "${FTABLE_COUNT:-0}" -gt 0 ]; then
            echo "    <include file="modules/$SCHEMA/015-foreign-tables.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/015-foreign-tables.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 015-foreign-tables.sql — $DB_NAME / $SCHEMA
-- Foreign tables (FDW) copied exact from DB
-- Requires FDW + foreign server to exist first (_db_level/fdw.sql)
-- ============================================================

--changeset dba:${SAFE_DB}-${SAFE_SCH}-ftables runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

EOF
            FTABLES=$(run_psql "$DB_NAME"                 "SELECT
                    ft.foreign_table_name,
                    ft.foreign_server_name
                 FROM information_schema.foreign_tables ft
                 WHERE ft.foreign_table_schema = '$SCHEMA'
                 ORDER BY ft.foreign_table_name;")

            while IFS='|' read -r FTNAME FTSERVER; do
                FTNAME=$(echo "$FTNAME" | xargs); [ -z "$FTNAME" ] && continue
                FTSERVER=$(echo "$FTSERVER" | xargs)

                # Get columns
                FTCOLS=$(run_psql "$DB_NAME"                     "SELECT string_agg(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position)
                     FROM information_schema.columns
                     WHERE table_schema = '$SCHEMA' AND table_name = '$FTNAME';")

                # Get options
                FTOPTS=$(run_psql "$DB_NAME"                     "SELECT string_agg(option_name || ' ' || quote_literal(option_value), ', ')
                     FROM information_schema.foreign_table_options
                     WHERE foreign_table_schema = '$SCHEMA'
                     AND foreign_table_name = '$FTNAME';")

                OPTS_CLAUSE=$([ -n "$FTOPTS" ] && echo "OPTIONS ($FTOPTS)" || echo "")
                echo "       + foreign table: $FTNAME → $FTSERVER"
                cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/015-foreign-tables.sql << EOF
    IF NOT EXISTS (
        SELECT FROM information_schema.foreign_tables
        WHERE foreign_table_schema = '$SCHEMA'
        AND foreign_table_name = '$FTNAME'
    ) THEN
        CREATE FOREIGN TABLE $SCHEMA.$FTNAME ($FTCOLS)
            SERVER $FTSERVER
            $OPTS_CLAUSE;
        RAISE NOTICE 'Created foreign table: $FTNAME';
    ELSE
        RAISE NOTICE 'Skipped: $FTNAME (already exists)';
    END IF;

EOF
            done <<< "$FTABLES"

            cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/015-foreign-tables.sql << EOF
END
\$\$
\$\$END

--rollback SELECT 'manual rollback for foreign tables';
EOF
            echo "     ✅ 015-foreign-tables.sql (${FTABLE_COUNT} foreign tables)"
        fi

        # ── 016-aggregates.sql ─────────────────────────────────
        if [ "${AGG_COUNT:-0}" -gt 0 ]; then
            echo "    <include file="modules/$SCHEMA/016-aggregates.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

            cat > $REPO/databases/$DB_NAME/modules/$SCHEMA/016-aggregates.sql << EOF
--liquibase formatted sql

-- ============================================================
-- 016-aggregates.sql — $DB_NAME / $SCHEMA
-- Custom aggregate functions copied exact from DB
-- ============================================================

EOF
            AGGS=$(run_psql "$DB_NAME"                 "SELECT p.proname
                 FROM pg_proc p
                 JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE p.prokind = 'a'
                 AND n.nspname = '$SCHEMA'
                 ORDER BY p.proname;")

            while IFS= read -r AGGNAME; do
                AGGNAME=$(echo "$AGGNAME" | xargs); [ -z "$AGGNAME" ] && continue
                echo "       + aggregate: $AGGNAME"
                AGGDEF=$(run_psql "$DB_NAME"                     "SELECT pg_get_functiondef(oid)
                     FROM pg_proc
                     WHERE proname = '$AGGNAME'
                     AND prokind = 'a'
                     AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = '$SCHEMA')
                     LIMIT 1;")
                if [ -n "$AGGDEF" ]; then
                    cat >> $REPO/databases/$DB_NAME/modules/$SCHEMA/016-aggregates.sql << EOF
--changeset dba:${SAFE_DB}-${SAFE_SCH}-agg-${AGGNAME} runOnChange:true endDelimiter:\$\$END
$AGGDEF
\$\$END

--rollback DROP AGGREGATE IF EXISTS $SCHEMA.$AGGNAME;
EOF
                fi
            done <<< "$AGGS"
            echo "     ✅ 016-aggregates.sql (${AGG_COUNT} aggregates)"
        fi

        echo "" >> $REPO/databases/$DB_NAME/changelog-root.xml
        IS_FIRST=false
        echo "  ✅ Schema $SCHEMA done"
    done

    # ── DB-level objects (not schema-scoped) ─────────────────

    # ── Extensions ────────────────────────────────────────────
    EXT_COUNT=$(run_psql "$DB_NAME"         "SELECT COUNT(*) FROM pg_extension
         WHERE extname NOT IN ('plpgsql');")

    if [ "${EXT_COUNT:-0}" -gt 0 ]; then
        mkdir -p $REPO/databases/$DB_NAME/modules/_db_level

        echo "    <include file="modules/_db_level/extensions.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

        cat > $REPO/databases/$DB_NAME/modules/_db_level/extensions.sql << EOF
--liquibase formatted sql

-- ============================================================
-- extensions.sql — $DB_NAME
-- Copied exact extensions from DB
-- These are database-level — not schema-scoped
-- ============================================================

--changeset dba:${SAFE_DB}-extensions runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

EOF
        EXTENSIONS=$(run_psql "$DB_NAME"             "SELECT e.extname, n.nspname
             FROM pg_extension e
             JOIN pg_namespace n ON n.oid = e.extnamespace
             WHERE e.extname NOT IN ('plpgsql')
             ORDER BY e.extname;")

        while IFS='|' read -r EXTNAME EXTSCHEMA; do
            EXTNAME=$(echo "$EXTNAME" | xargs); [ -z "$EXTNAME" ] && continue
            EXTSCHEMA=$(echo "$EXTSCHEMA" | xargs)
            echo "       + extension: $EXTNAME (schema: $EXTSCHEMA)"
            cat >> $REPO/databases/$DB_NAME/modules/_db_level/extensions.sql << EOF
    IF NOT EXISTS (SELECT FROM pg_extension WHERE extname = '$EXTNAME') THEN
        CREATE EXTENSION IF NOT EXISTS "$EXTNAME" SCHEMA $EXTSCHEMA;
        RAISE NOTICE 'Created extension: $EXTNAME';
    ELSE
        RAISE NOTICE 'Skipped: $EXTNAME (already exists)';
    END IF;

EOF
        done <<< "$EXTENSIONS"

        cat >> $REPO/databases/$DB_NAME/modules/_db_level/extensions.sql << EOF
END
\$\$
\$\$END

--rollback SELECT 'manual rollback for extensions';
EOF
        echo "     ✅ extensions.sql (${EXT_COUNT} extensions)"
    fi

    # ── Foreign Data Wrappers ──────────────────────────────────
    FDW_COUNT=$(run_psql "$DB_NAME"         "SELECT COUNT(*) FROM information_schema.foreign_data_wrappers;" 2>/dev/null || echo 0)

    if [ "${FDW_COUNT:-0}" -gt 0 ]; then
        mkdir -p $REPO/databases/$DB_NAME/modules/_db_level

        echo "    <include file="modules/_db_level/fdw.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

        cat > $REPO/databases/$DB_NAME/modules/_db_level/fdw.sql << EOF
--liquibase formatted sql

-- ============================================================
-- fdw.sql — $DB_NAME
-- Foreign Data Wrappers, Foreign Servers, User Mappings
-- and Foreign Tables copied exact from DB
-- ============================================================

--changeset dba:${SAFE_DB}-fdw runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

EOF
        # Foreign Data Wrappers
        FDWS=$(run_psql "$DB_NAME"             "SELECT foreign_data_wrapper_name
             FROM information_schema.foreign_data_wrappers
             ORDER BY foreign_data_wrapper_name;")

        while IFS= read -r FDWNAME; do
            FDWNAME=$(echo "$FDWNAME" | xargs); [ -z "$FDWNAME" ] && continue
            echo "       + FDW: $FDWNAME"
            cat >> $REPO/databases/$DB_NAME/modules/_db_level/fdw.sql << EOF
    IF NOT EXISTS (SELECT FROM pg_foreign_data_wrapper WHERE fdwname = '$FDWNAME') THEN
        CREATE FOREIGN DATA WRAPPER $FDWNAME;
        RAISE NOTICE 'Created FDW: $FDWNAME';
    ELSE
        RAISE NOTICE 'Skipped FDW: $FDWNAME (already exists)';
    END IF;

EOF
        done <<< "$FDWS"

        # Foreign Servers
        FSERVERS=$(run_psql "$DB_NAME"             "SELECT
                s.foreign_server_name,
                s.foreign_data_wrapper_name,
                s.foreign_server_type,
                array_to_string(
                    ARRAY(SELECT option_name || ' ' || quote_literal(option_value)
                          FROM information_schema.foreign_server_options
                          WHERE foreign_server_name = s.foreign_server_name
                          ORDER BY option_name), ', ') AS options
             FROM information_schema.foreign_servers s
             ORDER BY s.foreign_server_name;")

        while IFS='|' read -r SNAME SFDW STYPE SOPTS; do
            SNAME=$(echo "$SNAME" | xargs); [ -z "$SNAME" ] && continue
            SFDW=$(echo "$SFDW" | xargs)
            SOPTS=$(echo "$SOPTS" | xargs)
            OPTS_CLAUSE=$([ -n "$SOPTS" ] && echo "OPTIONS ($SOPTS)" || echo "")
            echo "       + Foreign Server: $SNAME"
            cat >> $REPO/databases/$DB_NAME/modules/_db_level/fdw.sql << EOF
    IF NOT EXISTS (SELECT FROM pg_foreign_server WHERE srvname = '$SNAME') THEN
        CREATE SERVER $SNAME
            FOREIGN DATA WRAPPER $SFDW
            $OPTS_CLAUSE;
        RAISE NOTICE 'Created foreign server: $SNAME';
    ELSE
        RAISE NOTICE 'Skipped foreign server: $SNAME (already exists)';
    END IF;

EOF
        done <<< "$FSERVERS"

        cat >> $REPO/databases/$DB_NAME/modules/_db_level/fdw.sql << EOF
END
\$\$
\$\$END

--rollback SELECT 'manual rollback for FDW';
EOF

        # User Mappings — separate changeset
        UMAPS=$(run_psql "$DB_NAME"             "SELECT
                um.authorization_identifier,
                um.foreign_server_name,
                array_to_string(
                    ARRAY(SELECT option_name || ' ' || quote_literal(option_value)
                          FROM information_schema.user_mapping_options
                          WHERE authorization_identifier = um.authorization_identifier
                          AND foreign_server_name = um.foreign_server_name
                          ORDER BY option_name), ', ') AS options
             FROM information_schema.user_mappings um
             ORDER BY um.foreign_server_name, um.authorization_identifier;")

        if [ -n "$UMAPS" ]; then
            cat >> $REPO/databases/$DB_NAME/modules/_db_level/fdw.sql << EOF

--changeset dba:${SAFE_DB}-fdw-usermappings runOnChange:true
EOF
            while IFS='|' read -r UUSER USERVER UOPTS; do
                UUSER=$(echo "$UUSER" | xargs); [ -z "$UUSER" ] && continue
                USERVER=$(echo "$USERVER" | xargs)
                UOPTS=$(echo "$UOPTS" | xargs)
                UOPTS_CLAUSE=$([ -n "$UOPTS" ] && echo "OPTIONS ($UOPTS)" || echo "")
                echo "       + User Mapping: $UUSER → $USERVER"
                echo "CREATE USER MAPPING IF NOT EXISTS FOR $UUSER SERVER $USERVER $UOPTS_CLAUSE;" >> $REPO/databases/$DB_NAME/modules/_db_level/fdw.sql
            done <<< "$UMAPS"
            echo "--rollback SELECT 'manual rollback for user mappings';" >> $REPO/databases/$DB_NAME/modules/_db_level/fdw.sql
        fi

        echo "     ✅ fdw.sql (${FDW_COUNT} FDWs)"
    fi

    # ── Domain types (not enum — custom domains with constraints) ─
    DOMAIN_COUNT=$(run_psql "$DB_NAME"         "SELECT COUNT(*) FROM information_schema.domains
         WHERE domain_schema NOT IN ('pg_catalog','information_schema');")

    if [ "${DOMAIN_COUNT:-0}" -gt 0 ]; then
        mkdir -p $REPO/databases/$DB_NAME/modules/_db_level

        echo "    <include file="modules/_db_level/domains.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

        cat > $REPO/databases/$DB_NAME/modules/_db_level/domains.sql << EOF
--liquibase formatted sql

-- ============================================================
-- domains.sql — $DB_NAME
-- Custom domain types with constraints
-- ============================================================

--changeset dba:${SAFE_DB}-domains runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

EOF
        DOMAINS=$(run_psql "$DB_NAME"             "SELECT
                d.domain_schema,
                d.domain_name,
                d.data_type,
                d.character_maximum_length,
                d.domain_default,
                c.check_clause
             FROM information_schema.domains d
             LEFT JOIN information_schema.domain_constraints dc
                 ON dc.domain_name = d.domain_name
                 AND dc.domain_schema = d.domain_schema
             LEFT JOIN information_schema.check_constraints c
                 ON c.constraint_name = dc.constraint_name
             WHERE d.domain_schema NOT IN ('pg_catalog','information_schema')
             ORDER BY d.domain_schema, d.domain_name;")

        while IFS='|' read -r DSCHEMA DNAME DTYPE DLEN DDEFAULT DCHECK; do
            DNAME=$(echo "$DNAME" | xargs); [ -z "$DNAME" ] && continue
            DSCHEMA=$(echo "$DSCHEMA" | xargs)
            DTYPE=$(echo "$DTYPE" | xargs)
            DLEN=$(echo "$DLEN" | xargs)
            DDEFAULT=$(echo "$DDEFAULT" | xargs)
            DCHECK=$(echo "$DCHECK" | xargs)
            TYPE_CLAUSE=$([ -n "$DLEN" ] && echo "$DTYPE($DLEN)" || echo "$DTYPE")
            DEFAULT_CLAUSE=$([ -n "$DDEFAULT" ] && echo "DEFAULT $DDEFAULT" || echo "")
            CHECK_CLAUSE=$([ -n "$DCHECK" ] && echo "CHECK ($DCHECK)" || echo "")
            echo "       + domain: $DSCHEMA.$DNAME"
            cat >> $REPO/databases/$DB_NAME/modules/_db_level/domains.sql << EOF
    IF NOT EXISTS (
        SELECT FROM information_schema.domains
        WHERE domain_schema = '$DSCHEMA' AND domain_name = '$DNAME'
    ) THEN
        CREATE DOMAIN $DSCHEMA.$DNAME AS $TYPE_CLAUSE $DEFAULT_CLAUSE $CHECK_CLAUSE;
        RAISE NOTICE 'Created domain: $DNAME';
    ELSE
        RAISE NOTICE 'Skipped: $DNAME (already exists)';
    END IF;

EOF
        done <<< "$DOMAINS"

        cat >> $REPO/databases/$DB_NAME/modules/_db_level/domains.sql << EOF
END
\$\$
\$\$END

--rollback SELECT 'manual rollback for domains';
EOF
        echo "     ✅ domains.sql (${DOMAIN_COUNT} domains)"
    fi

    # ── Publications / Subscriptions (logical replication) ───
    PUB_COUNT=$(run_psql "$DB_NAME"         "SELECT COUNT(*) FROM pg_publication;" 2>/dev/null || echo 0)

    if [ "${PUB_COUNT:-0}" -gt 0 ]; then
        mkdir -p $REPO/databases/$DB_NAME/modules/_db_level
        echo "    <include file="modules/_db_level/replication.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

        cat > $REPO/databases/$DB_NAME/modules/_db_level/replication.sql << EOF
--liquibase formatted sql

-- ============================================================
-- replication.sql — $DB_NAME
-- Publications and Subscriptions for logical replication
-- ============================================================

--changeset dba:${SAFE_DB}-publications runOnChange:true
EOF
        PUBS=$(run_psql "$DB_NAME"             "SELECT pubname,
                    CASE WHEN puballtables THEN 'FOR ALL TABLES' ELSE '' END,
                    CASE WHEN pubinsert THEN 'insert' ELSE '' END,
                    CASE WHEN pubupdate THEN 'update' ELSE '' END,
                    CASE WHEN pubdelete THEN 'delete' ELSE '' END,
                    CASE WHEN pubtruncate THEN 'truncate' ELSE '' END
             FROM pg_publication
             ORDER BY pubname;")

        while IFS='|' read -r PUBNAME PUBALL PINS PUPD PDEL PTRNC; do
            PUBNAME=$(echo "$PUBNAME" | xargs); [ -z "$PUBNAME" ] && continue
            EVENTS=$(echo "$PINS $PUPD $PDEL $PTRNC" | xargs | tr ' ' ',')
            ALL_CLAUSE=$(echo "$PUBALL" | xargs)
            echo "       + publication: $PUBNAME"
            cat >> $REPO/databases/$DB_NAME/modules/_db_level/replication.sql << EOF
CREATE PUBLICATION IF NOT EXISTS $PUBNAME
    $ALL_CLAUSE
    WITH (publish = '$EVENTS');
EOF
        done <<< "$PUBS"
        echo "" >> $REPO/databases/$DB_NAME/modules/_db_level/replication.sql
        echo "--rollback SELECT 'manual rollback for publications';" >> $REPO/databases/$DB_NAME/modules/_db_level/replication.sql
        echo "     ✅ replication.sql (${PUB_COUNT} publications)"
    fi

    # ── Event Triggers (DB-level triggers) ────────────────────
    EVTRIG_COUNT=$(run_psql "$DB_NAME"         "SELECT COUNT(*) FROM pg_event_trigger;" 2>/dev/null || echo 0)

    if [ "${EVTRIG_COUNT:-0}" -gt 0 ]; then
        mkdir -p $REPO/databases/$DB_NAME/modules/_db_level
        echo "    <include file="modules/_db_level/event-triggers.sql"/>" >> $REPO/databases/$DB_NAME/changelog-root.xml

        cat > $REPO/databases/$DB_NAME/modules/_db_level/event-triggers.sql << EOF
--liquibase formatted sql

-- ============================================================
-- event-triggers.sql — $DB_NAME
-- Database-level event triggers (ddl_command_start etc.)
-- ============================================================

--changeset dba:${SAFE_DB}-event-triggers runOnChange:true endDelimiter:\$\$END
DO \$\$
BEGIN

EOF
        EVTRIGS=$(run_psql "$DB_NAME"             "SELECT evtname, evtevent, evtfoid::regproc
             FROM pg_event_trigger
             ORDER BY evtname;")

        while IFS='|' read -r ETNAME ETEVENT ETFUNC; do
            ETNAME=$(echo "$ETNAME" | xargs); [ -z "$ETNAME" ] && continue
            ETEVENT=$(echo "$ETEVENT" | xargs)
            ETFUNC=$(echo "$ETFUNC" | xargs)
            echo "       + event trigger: $ETNAME ($ETEVENT)"
            cat >> $REPO/databases/$DB_NAME/modules/_db_level/event-triggers.sql << EOF
    IF NOT EXISTS (SELECT FROM pg_event_trigger WHERE evtname = '$ETNAME') THEN
        CREATE EVENT TRIGGER $ETNAME ON $ETEVENT
            EXECUTE FUNCTION $ETFUNC();
        RAISE NOTICE 'Created event trigger: $ETNAME';
    ELSE
        RAISE NOTICE 'Skipped: $ETNAME (already exists)';
    END IF;

EOF
        done <<< "$EVTRIGS"
        cat >> $REPO/databases/$DB_NAME/modules/_db_level/event-triggers.sql << EOF
END
\$\$
\$\$END

--rollback SELECT 'manual rollback for event triggers';
EOF
        echo "     ✅ event-triggers.sql (${EVTRIG_COUNT} event triggers)"
    fi

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
        changelog-sync 2>&1 | tail -3

    echo "  ✅ $DB_NAME done!"
    cd $REPO

done

echo ""
echo "============================================"
echo " ✅ All databases migrated!"
echo ""
echo " Files created only where content exists:"
echo "   001-roles.sql      → only if roles found"
echo "   002-users.sql      → only if users found"
echo "   003-schema.sql     → always"
echo "   005-tables.sql     → only if tables found"
echo "   006-views.sql      → only if views found"
echo "   007-indexes.sql    → only if indexes found"
echo "   008-functions.sql  → only if functions found"
echo "   009-procedures.sql → only if procedures found"
echo ""
echo " Next steps:"
echo "   git add databases/"
echo "   git commit -m 'feat: copy exact structure from all DBs'"
echo "   git push origin development"
echo "============================================"

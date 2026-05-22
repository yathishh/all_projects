#!/bin/bash

# =============================================================================
# Script  : check_missing_pk.sh
# Purpose : Find all tables missing PRIMARY KEYs across all databases & schemas
# Safe    : READ-ONLY queries — no locks, no writes to the cluster
# Output  : missing_primary_keys_<timestamp>.txt
# =============================================================================

# ─── CONNECTION SETTINGS ─────────────────────────────────────────────────────
PG_HOST="${PG_HOST:-pgsql_cluster.adhkiapps.com}"
PG_PORT="${PG_PORT:-5001}"
PG_USER="${PG_USER:-postgres}"
# Set PGPASSWORD in your environment or use ~/.pgpass — never hard-code it
export PGPASSWORD="postgres"

# ─── OUTPUT FILE ─────────────────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="pkey_missing_tables/missing_primary_keys_${TIMESTAMP}.txt"

# ─── SCHEMAS TO SKIP (system schemas) ────────────────────────────────────────
SKIP_SCHEMAS="'pg_catalog','information_schema','pg_toast','pg_temp_1','pg_toast_temp_1'"

# ─── DATABASES TO SKIP ───────────────────────────────────────────────────────
SKIP_DATABASES="'template0','template1','rdsadmin'"   # add more if needed

# ─── COLORS (terminal only) ──────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ─── HELPERS ─────────────────────────────────────────────────────────────────
log()   { echo -e "$*"; }
info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error() { echo -e "${RED}[ERROR]${RESET} $*"; }
ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }

psql_cmd() {
    # $1 = database, rest = sql
    local db="$1"; shift
    psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$db" \
         -v ON_ERROR_STOP=1 --no-password -AXqt "$@" 2>&1
}

# ─── WRITE HEADER TO OUTPUT FILE ─────────────────────────────────────────────
write_header() {
cat > "$OUTPUT_FILE" <<EOF
================================================================================
  PostgreSQL — Tables Missing PRIMARY KEY
  Host      : ${PG_HOST}:${PG_PORT}
  Run by    : ${PG_USER}
  Timestamp : $(date "+%Y-%m-%d %H:%M:%S %Z")
================================================================================

EOF
}

# ─── CHECK CONNECTIVITY ──────────────────────────────────────────────────────
check_connection() {
    info "Testing connection to ${PG_HOST}:${PG_PORT} as '${PG_USER}' ..."
    psql_cmd "postgres" -c "SELECT 1;" > /dev/null 2>&1
    if [[ $? -ne 0 ]]; then
        error "Cannot connect to PostgreSQL. Check PG_HOST / PG_PORT / PG_USER / PGPASSWORD."
        exit 1
    fi
    ok "Connection successful."
}

# ─── FETCH DATABASE LIST ─────────────────────────────────────────────────────
get_databases() {
    psql_cmd "postgres" -c \
        "SELECT datname FROM pg_database
          WHERE datistemplate = false
            AND datallowconn  = true
            AND datname NOT IN (${SKIP_DATABASES})
          ORDER BY datname;"
}

# ─── FETCH SCHEMA LIST FOR A DATABASE ────────────────────────────────────────
get_schemas() {
    local db="$1"
    psql_cmd "$db" -c \
        "SELECT schema_name FROM information_schema.schemata
          WHERE schema_name NOT IN (${SKIP_SCHEMAS})
          ORDER BY schema_name;"
}

# ─── FIND TABLES WITHOUT PK IN A SCHEMA ──────────────────────────────────────
# Uses information_schema only — purely read-only, acquires NO locks
get_tables_without_pk() {
    local db="$1"
    local schema="$2"
    psql_cmd "$db" -c \
        "SELECT t.table_name
           FROM information_schema.tables t
          WHERE t.table_schema = '${schema}'
            AND t.table_type   = 'BASE TABLE'
            AND t.table_name NOT IN (
                SELECT ku.table_name
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage   ku
                    ON tc.constraint_name = ku.constraint_name
                   AND tc.table_schema    = ku.table_schema
                 WHERE tc.constraint_type = 'PRIMARY KEY'
                   AND tc.table_schema    = '${schema}'
            )
          ORDER BY t.table_name;"
}

# ─── MAIN ─────────────────────────────────────────────────────────────────────
main() {
    write_header
    check_connection

    local total_tables=0
    local total_missing=0
    local db_count=0
    local db_with_issues=0

    log ""
    info "Fetching list of databases ..."
    mapfile -t DATABASES < <(get_databases)

    if [[ ${#DATABASES[@]} -eq 0 ]]; then
        warn "No accessible databases found."
        exit 0
    fi

    info "Found ${#DATABASES[@]} database(s): ${DATABASES[*]}"
    log ""

    # ── Loop over each database ──────────────────────────────────────────────
    for db in "${DATABASES[@]}"; do
        [[ -z "$db" ]] && continue
        (( db_count++ ))

        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        info "Database [$db_count/${#DATABASES[@]}]: ${BOLD}${db}${RESET}"
        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Write DB header to file
        {
          echo "════════════════════════════════════════════════"
          echo "  DATABASE: ${db}"
          echo "════════════════════════════════════════════════"
        } >> "$OUTPUT_FILE"

        db_missing=0

        # Check if we can connect to this DB
        psql_cmd "$db" -c "SELECT 1;" > /dev/null 2>&1
        if [[ $? -ne 0 ]]; then
            warn "  Cannot connect to '${db}'. Skipping."
            echo "  [SKIPPED] Cannot connect to this database." >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            continue
        fi

        # ── Loop over each schema ────────────────────────────────────────────
        mapfile -t SCHEMAS < <(get_schemas "$db")

        if [[ ${#SCHEMAS[@]} -eq 0 ]]; then
            info "  No user schemas found in '${db}'. Skipping."
            echo "  No user schemas found." >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            continue
        fi

        info "  Found ${#SCHEMAS[@]} schema(s): ${SCHEMAS[*]}"

        for schema in "${SCHEMAS[@]}"; do
            [[ -z "$schema" ]] && continue

            info "  └─ Checking schema: ${BOLD}${schema}${RESET}"

            mapfile -t MISSING_TABLES < <(get_tables_without_pk "$db" "$schema")

            # Filter empty lines
            VALID_MISSING=()
            for t in "${MISSING_TABLES[@]}"; do
                [[ -n "$t" ]] && VALID_MISSING+=("$t")
            done

            schema_table_count=$(psql_cmd "$db" -c \
                "SELECT COUNT(*) FROM information_schema.tables
                  WHERE table_schema='${schema}' AND table_type='BASE TABLE';" 2>/dev/null | tr -d '[:space:]')

            total_tables=$(( total_tables + schema_table_count ))

            if [[ ${#VALID_MISSING[@]} -eq 0 ]]; then
                ok "     All tables in '${schema}' have primary keys ✓"
                {
                  echo "  Schema: ${schema}"
                  echo "    [OK] All ${schema_table_count} table(s) have primary keys."
                  echo ""
                } >> "$OUTPUT_FILE"
            else
                missing_count=${#VALID_MISSING[@]}
                total_missing=$(( total_missing + missing_count ))
                db_missing=$(( db_missing + missing_count ))
                warn "     ${missing_count} table(s) missing PK in '${schema}':"

                {
                  echo "  Schema: ${schema}  (${schema_table_count} total tables, ${missing_count} missing PK)"
                  echo "  ┌─────────────────────────────────────────────"
                } >> "$OUTPUT_FILE"

                for tbl in "${VALID_MISSING[@]}"; do
                    warn "       ✗  ${db}.${schema}.${tbl}"
                    echo "  │  ✗  ${tbl}" >> "$OUTPUT_FILE"
                done

                echo "  └─────────────────────────────────────────────" >> "$OUTPUT_FILE"
                echo "" >> "$OUTPUT_FILE"
            fi
        done  # end schema loop

        [[ $db_missing -gt 0 ]] && (( db_with_issues++ ))
        echo "" >> "$OUTPUT_FILE"

    done  # end database loop

    # ── Write summary ────────────────────────────────────────────────────────
    {
      echo "════════════════════════════════════════════════"
      echo "  SUMMARY"
      echo "════════════════════════════════════════════════"
      echo "  Databases scanned          : ${db_count}"
      echo "  Databases with missing PKs : ${db_with_issues}"
      echo "  Total tables scanned       : ${total_tables}"
      echo "  Tables missing PRIMARY KEY : ${total_missing}"
      echo "  Completed at               : $(date '+%Y-%m-%d %H:%M:%S %Z')"
      echo "════════════════════════════════════════════════"
    } >> "$OUTPUT_FILE"

    log ""
    log "════════════════════════════════════════════════"
    log "  ${BOLD}SUMMARY${RESET}"
    log "  Databases scanned          : ${db_count}"
    log "  Databases with issues      : ${db_with_issues}"
    log "  Total tables scanned       : ${total_tables}"
    log "  ${RED}Tables missing PRIMARY KEY : ${total_missing}${RESET}"
    log "════════════════════════════════════════════════"
    log ""
    ok "Results written to: ${BOLD}${OUTPUT_FILE}${RESET}"
}

main "$@"

#!/bin/bash

# =============================================================================
# Script  : mariadb_check_missing_pk.sh
# Purpose : Find all tables missing PRIMARY KEYs across all databases in MariaDB
# Safe    : READ-ONLY queries — no locks, no writes to the cluster
# Output  : mariadb_missing_pk_<timestamp>.txt
# =============================================================================

# ─── CONNECTION SETTINGS ─────────────────────────────────────────────────────
DB_HOST="${DB_HOST:-172.30.19.11}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-Password1!}"           

# ─── OUTPUT FILE ─────────────────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="mariadb_missing_pk_${TIMESTAMP}.txt"

# ─── DATABASES TO SKIP (system databases) ────────────────────────────────────
SKIP_DATABASES="'information_schema','performance_schema','mysql','sys'"

# ─── COLORS (terminal only) ──────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ─── HELPERS ─────────────────────────────────────────────────────────────────
log()   { echo -e "$*"; }
info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error() { echo -e "${RED}[ERROR]${RESET} $*"; }
ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }

# ─── BUILD MYSQL COMMAND ─────────────────────────────────────────────────────
# Builds a safe mysql CLI call; uses -p only when password is set
mysql_cmd() {
    local db="$1"; shift
    if [[ -n "$DB_PASS" ]]; then
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
              --database="$db" --batch --skip-column-names \
              --silent "$@" 2>&1
    else
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
              --database="$db" --batch --skip-column-names \
              --silent "$@" 2>&1
    fi
}

# ─── WRITE HEADER TO OUTPUT FILE ─────────────────────────────────────────────
write_header() {
cat > "$OUTPUT_FILE" <<EOF
================================================================================
  MariaDB — Tables Missing PRIMARY KEY
  Host      : ${DB_HOST}:${DB_PORT}
  Run by    : ${DB_USER}
  Timestamp : $(date "+%Y-%m-%d %H:%M:%S %Z")
================================================================================

EOF
}

# ─── CHECK CONNECTIVITY ──────────────────────────────────────────────────────
check_connection() {
    info "Testing connection to ${DB_HOST}:${DB_PORT} as '${DB_USER}' ..."
    result=$(mysql_cmd "information_schema" -e "SELECT 1;" 2>&1)
    if [[ $? -ne 0 ]]; then
        error "Cannot connect to MariaDB. Check DB_HOST / DB_PORT / DB_USER / DB_PASS."
        error "Detail: $result"
        exit 1
    fi
    ok "Connection successful."
}

# ─── FETCH DATABASE LIST ─────────────────────────────────────────────────────
get_databases() {
    mysql_cmd "information_schema" -e \
        "SELECT SCHEMA_NAME
           FROM information_schema.SCHEMATA
          WHERE SCHEMA_NAME NOT IN (${SKIP_DATABASES})
          ORDER BY SCHEMA_NAME;"
}

# ─── TOTAL TABLE COUNT FOR A DATABASE ────────────────────────────────────────
get_table_count() {
    local db="$1"
    mysql_cmd "information_schema" -e \
        "SELECT COUNT(*)
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = '${db}'
            AND TABLE_TYPE   = 'BASE TABLE';" 2>/dev/null | tr -d '[:space:]'
}

# ─── FIND TABLES WITHOUT PK IN A DATABASE ────────────────────────────────────
# Reads information_schema only — purely READ-ONLY, acquires NO table locks
get_tables_without_pk() {
    local db="$1"
    mysql_cmd "information_schema" -e \
        "SELECT t.TABLE_NAME
           FROM information_schema.TABLES t
          WHERE t.TABLE_SCHEMA = '${db}'
            AND t.TABLE_TYPE   = 'BASE TABLE'
            AND t.TABLE_NAME NOT IN (
                SELECT s.TABLE_NAME
                  FROM information_schema.STATISTICS s
                 WHERE s.TABLE_SCHEMA = '${db}'
                   AND s.INDEX_NAME   = 'PRIMARY'
            )
          ORDER BY t.TABLE_NAME;"
}

# ─── MAIN ─────────────────────────────────────────────────────────────────────
main() {
    write_header
    check_connection

    local total_tables=0
    local total_missing=0
    local db_count=0
    local db_with_issues=0
    local db_skipped=0

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

        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        info "Database [$db_count/${#DATABASES[@]}]: ${BOLD}${db}${RESET}"
        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Write DB header to file
        {
          echo "════════════════════════════════════════════════════════════"
          printf "  DATABASE: %-48s\n" "${db}"
          echo "════════════════════════════════════════════════════════════"
        } >> "$OUTPUT_FILE"

        # Get total table count
        table_count=$(get_table_count "$db")
        total_tables=$(( total_tables + table_count ))

        info "  Total BASE tables: ${table_count}"

        if [[ "$table_count" -eq 0 ]]; then
            info "  No user tables in '${db}'. Skipping."
            echo "  No user tables found in this database." >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            continue
        fi

        # Get tables missing PK
        mapfile -t MISSING_TABLES < <(get_tables_without_pk "$db")

        # Filter empty lines
        VALID_MISSING=()
        for t in "${MISSING_TABLES[@]}"; do
            [[ -n "$t" ]] && VALID_MISSING+=("$t")
        done

        missing_count=${#VALID_MISSING[@]}

        if [[ $missing_count -eq 0 ]]; then
            ok "  ✓  All ${table_count} table(s) have a PRIMARY KEY."
            {
              echo "  Total tables : ${table_count}"
              echo "  Missing PKs  : 0"
              echo "  [OK] All tables have primary keys."
              echo ""
            } >> "$OUTPUT_FILE"
        else
            total_missing=$(( total_missing + missing_count ))
            (( db_with_issues++ ))
            warn "  ✗  ${missing_count} of ${table_count} table(s) are missing a PRIMARY KEY:"

            {
              echo "  Total tables : ${table_count}"
              echo "  Missing PKs  : ${missing_count}"
              echo ""
              printf "  %-5s  %-60s\n" "No."  "Table Name"
              printf "  %-5s  %-60s\n" "─────" "────────────────────────────────────────────────────────────"
            } >> "$OUTPUT_FILE"

            idx=0
            for tbl in "${VALID_MISSING[@]}"; do
                (( idx++ ))
                warn "       [$idx]  ${db}.${tbl}"
                printf "  %-5s  %-60s\n" "${idx}." "${tbl}" >> "$OUTPUT_FILE"
            done

            echo "" >> "$OUTPUT_FILE"
        fi

        echo "" >> "$OUTPUT_FILE"

    done  # end database loop

    # ── Write summary ────────────────────────────────────────────────────────
    {
      echo "════════════════════════════════════════════════════════════"
      echo "  FINAL SUMMARY"
      echo "════════════════════════════════════════════════════════════"
      printf "  %-38s : %s\n" "Databases scanned"              "${db_count}"
      printf "  %-38s : %s\n" "Databases with missing PKs"     "${db_with_issues}"
      printf "  %-38s : %s\n" "Databases fully OK"             "$(( db_count - db_with_issues ))"
      printf "  %-38s : %s\n" "Total tables scanned"           "${total_tables}"
      printf "  %-38s : %s\n" "Tables MISSING PRIMARY KEY"     "${total_missing}"
      printf "  %-38s : %s\n" "Completed at"                   "$(date '+%Y-%m-%d %H:%M:%S %Z')"
      echo "════════════════════════════════════════════════════════════"
    } >> "$OUTPUT_FILE"

    log ""
    log "════════════════════════════════════════════════════════════"
    log "  ${BOLD}FINAL SUMMARY${RESET}"
    log "  Databases scanned          : ${db_count}"
    log "  Databases with issues      : ${db_with_issues}"
    log "  Databases fully OK         : $(( db_count - db_with_issues ))"
    log "  Total tables scanned       : ${total_tables}"
    log "  ${RED}Tables missing PRIMARY KEY : ${total_missing}${RESET}"
    log "════════════════════════════════════════════════════════════"
    log ""
    ok "Results written to: ${BOLD}${OUTPUT_FILE}${RESET}"
}

main "$@"

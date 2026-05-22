#!/bin/bash
# =============================================================================
# PostgreSQL Unused & Redundant (Dummy) Index Report Generator
# =============================================================================
# Usage:
#   ./pg_index_report.sh [options]
#
# Options:
#   -h HOST       PostgreSQL host          (default: localhost)
#   -p PORT       PostgreSQL port          (default: 5432)
#   -U USER       PostgreSQL user          (default: postgres)
#   -W PASSWORD   PostgreSQL password      (optional, or use .pgpass)
#   -o OUTPUT_DIR Output directory         (default: ./pg_index_reports)
#   -x EXCLUDE_DB Comma-separated DBs to skip (default: postgres,template0,template1)
#   --help        Show this help message
#
# Requirements:
#   - psql client installed
#   - Superuser or pg_monitor role recommended
# =============================================================================

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────
PG_HOST="pgsql_cluster.adhkiapps.com"
PG_PORT="5432"
PG_USER="postgres"
PG_PASSWORD="postgres"
OUTPUT_DIR="./pg_index_reports"
EXCLUDE_DBS="postgres,template0,template1"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SUMMARY_FILE=""

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Argument Parsing ─────────────────────────────────────────────────────────
usage() {
    sed -n '2,20p' "$0" | sed 's/^# //' | sed 's/^#//'
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h) PG_HOST="$2";     shift 2 ;;
        -p) PG_PORT="$2";     shift 2 ;;
        -U) PG_USER="$2";     shift 2 ;;
        -W) PG_PASSWORD="$2"; shift 2 ;;
        -o) OUTPUT_DIR="$2";  shift 2 ;;
        -x) EXCLUDE_DBS="$2"; shift 2 ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

# ─── Setup ───────────────────────────────────────────────────────────────────
[[ -n "$PG_PASSWORD" ]] && export PGPASSWORD="$PG_PASSWORD"

mkdir -p "$OUTPUT_DIR"
SUMMARY_FILE="$OUTPUT_DIR/SUMMARY_${TIMESTAMP}.txt"

PSQL="psql -h $PG_HOST -p $PG_PORT -U $PG_USER -X -A -t"

log()     { echo -e "${CYAN}[INFO]${RESET}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
section() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}"; \
            echo -e "${BOLD}  $*${RESET}"; \
            echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"; }

# ─── Test Connection ──────────────────────────────────────────────────────────
log "Testing PostgreSQL connection to $PG_HOST:$PG_PORT as $PG_USER ..."
if ! $PSQL -d postgres -c "SELECT 1" &>/dev/null; then
    echo -e "${RED}[ERROR]${RESET} Cannot connect to PostgreSQL. Check credentials/host/port."
    exit 1
fi
success "Connection successful."

# ─── Fetch Database List ──────────────────────────────────────────────────────
section "Fetching Database List"

# Build exclusion filter
EXCLUDE_FILTER=$(echo "$EXCLUDE_DBS" | tr ',' '\n' | sed "s/.*/'&'/" | paste -sd,)

DB_LIST=$($PSQL -d postgres -F'|' -c "
    SELECT datname
    FROM pg_database
    WHERE datistemplate = false
      AND datname NOT IN ($EXCLUDE_FILTER)
    ORDER BY datname;
" 2>/dev/null | grep -v '^$')

if [[ -z "$DB_LIST" ]]; then
    warn "No user databases found (after exclusions). Exiting."
    exit 0
fi

DB_COUNT=$(echo "$DB_LIST" | wc -l | tr -d ' ')
log "Found ${BOLD}$DB_COUNT${RESET} database(s): $(echo "$DB_LIST" | tr '\n' ',' | sed 's/,$//')"

# ─── Summary Header ───────────────────────────────────────────────────────────
{
    echo "============================================================"
    echo "  PostgreSQL Index Health Report"
    echo "  Host      : $PG_HOST:$PG_PORT"
    echo "  User      : $PG_USER"
    echo "  Generated : $(date)"
    echo "============================================================"
    echo ""
} > "$SUMMARY_FILE"

TOTAL_UNUSED=0
TOTAL_REDUNDANT=0
TOTAL_NEVER_USED=0

# ─── Per-Database Processing ──────────────────────────────────────────────────
while IFS= read -r DBNAME; do
    [[ -z "$DBNAME" ]] && continue

    section "Database: $DBNAME"

    DB_REPORT_DIR="$OUTPUT_DIR/${DBNAME}"
    mkdir -p "$DB_REPORT_DIR"
    DB_REPORT_FILE="$DB_REPORT_DIR/index_report_${TIMESTAMP}.txt"

    {
        echo "============================================================"
        echo "  DATABASE : $DBNAME"
        echo "  Host     : $PG_HOST:$PG_PORT"
        echo "  Report   : $(date)"
        echo "============================================================"
        echo ""
    } > "$DB_REPORT_FILE"

    # ── 1. Schema List ────────────────────────────────────────────────────────
    log "[$DBNAME] Fetching schemas..."

    SCHEMA_LIST=$($PSQL -d "$DBNAME" -c "
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
          AND schema_name NOT LIKE 'pg_temp_%'
          AND schema_name NOT LIKE 'pg_toast_temp_%'
        ORDER BY schema_name;
    " 2>/dev/null | grep -v '^$')

    SCHEMA_COUNT=$(echo "$SCHEMA_LIST" | grep -c '[^[:space:]]' || true)
    log "[$DBNAME] Found $SCHEMA_COUNT schema(s): $(echo "$SCHEMA_LIST" | tr '\n' ',' | sed 's/,$//')"

    {
        echo "────────────────────────────────────────────────────────────"
        echo "  SCHEMAS IN THIS DATABASE ($SCHEMA_COUNT found)"
        echo "────────────────────────────────────────────────────────────"
        echo "$SCHEMA_LIST" | awk '{print "  • " $0}'
        echo ""
    } >> "$DB_REPORT_FILE"

    # ── 2. Unused Indexes ─────────────────────────────────────────────────────
    log "[$DBNAME] Scanning for UNUSED indexes (scans = 0) ..."

    UNUSED_INDEXES=$($PSQL -d "$DBNAME" -F'|' -c "
        SELECT
            n.nspname                          AS schema_name,
            t.relname                          AS table_name,
            i.relname                          AS index_name,
            pg_size_pretty(pg_relation_size(ix.indexrelid)) AS index_size,
            s.idx_scan                         AS index_scans,
            s.idx_tup_read                     AS tuples_read,
            s.idx_tup_fetch                    AS tuples_fetched,
            am.amname                          AS index_type,
            ix.indisunique                     AS is_unique,
            ix.indisprimary                    AS is_primary,
            pg_get_indexdef(ix.indexrelid)     AS index_definition
        FROM
            pg_stat_user_indexes s
            JOIN pg_index ix   ON s.indexrelid = ix.indexrelid
            JOIN pg_class  i   ON i.oid        = s.indexrelid
            JOIN pg_class  t   ON t.oid        = ix.indrelid
            JOIN pg_namespace n ON n.oid       = t.relnamespace
            JOIN pg_am am      ON am.oid       = i.relam
        WHERE
            s.idx_scan = 0
            AND NOT ix.indisunique
            AND NOT ix.indisprimary
            AND NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                WHERE c.conindid = ix.indexrelid
            )
        ORDER BY
            n.nspname, t.relname, pg_relation_size(ix.indexrelid) DESC;
    " 2>/dev/null | grep -v '^$')

    UNUSED_COUNT=$(echo "$UNUSED_INDEXES" | grep -c '[^[:space:]]' || true)
    TOTAL_UNUSED=$((TOTAL_UNUSED + UNUSED_COUNT))

    {
        echo "────────────────────────────────────────────────────────────"
        printf "  %-55s (%d found)\n" "UNUSED INDEXES (idx_scan = 0, non-PK/unique)" "$UNUSED_COUNT"
        echo "────────────────────────────────────────────────────────────"
    } >> "$DB_REPORT_FILE"

    if [[ -z "$UNUSED_INDEXES" || "$UNUSED_COUNT" -eq 0 ]]; then
        echo "  ✓ No unused indexes found." >> "$DB_REPORT_FILE"
    else
        # Header row
        printf "  %-20s %-25s %-35s %-10s %-8s %-12s\n" \
            "SCHEMA" "TABLE" "INDEX" "SIZE" "SCANS" "TYPE" >> "$DB_REPORT_FILE"
        printf "  %-20s %-25s %-35s %-10s %-8s %-12s\n" \
            "──────────────────" "─────────────────────────" \
            "───────────────────────────────────" "──────────" "────────" "────────────" >> "$DB_REPORT_FILE"

        while IFS='|' read -r schema tbl idx sz scans tread tfetch itype isuniq ispk idef; do
            printf "  %-20s %-25s %-35s %-10s %-8s %-12s\n" \
                "$schema" "$tbl" "$idx" "$sz" "$scans" "$itype" >> "$DB_REPORT_FILE"
            echo "    DDL: $idef" >> "$DB_REPORT_FILE"
        done <<< "$UNUSED_INDEXES"
    fi
    echo "" >> "$DB_REPORT_FILE"

    # ── 3. Never-Used Indexes (with size > threshold) ─────────────────────────
    log "[$DBNAME] Scanning for LARGE never-used indexes (size > 1MB) ..."

    LARGE_UNUSED=$($PSQL -d "$DBNAME" -F'|' -c "
        SELECT
            n.nspname                             AS schema_name,
            t.relname                             AS table_name,
            i.relname                             AS index_name,
            pg_size_pretty(pg_relation_size(ix.indexrelid)) AS index_size,
            pg_relation_size(ix.indexrelid)       AS raw_size,
            s.idx_scan                            AS index_scans,
            pg_get_indexdef(ix.indexrelid)        AS index_definition
        FROM
            pg_stat_user_indexes s
            JOIN pg_index ix   ON s.indexrelid = ix.indexrelid
            JOIN pg_class  i   ON i.oid        = s.indexrelid
            JOIN pg_class  t   ON t.oid        = ix.indrelid
            JOIN pg_namespace n ON n.oid       = t.relnamespace
        WHERE
            s.idx_scan = 0
            AND NOT ix.indisunique
            AND NOT ix.indisprimary
            AND pg_relation_size(ix.indexrelid) > 1048576
        ORDER BY
            pg_relation_size(ix.indexrelid) DESC;
    " 2>/dev/null | grep -v '^$')

    LARGE_COUNT=$(echo "$LARGE_UNUSED" | grep -c '[^[:space:]]' || true)
    TOTAL_NEVER_USED=$((TOTAL_NEVER_USED + LARGE_COUNT))

    {
        echo "────────────────────────────────────────────────────────────"
        printf "  %-55s (%d found)\n" "LARGE UNUSED INDEXES (>1MB, 0 scans)" "$LARGE_COUNT"
        echo "────────────────────────────────────────────────────────────"
    } >> "$DB_REPORT_FILE"

    if [[ -z "$LARGE_UNUSED" || "$LARGE_COUNT" -eq 0 ]]; then
        echo "  ✓ No large unused indexes found." >> "$DB_REPORT_FILE"
    else
        printf "  %-20s %-25s %-35s %-12s %-8s\n" \
            "SCHEMA" "TABLE" "INDEX" "SIZE" "SCANS" >> "$DB_REPORT_FILE"
        printf "  %-20s %-25s %-35s %-12s %-8s\n" \
            "──────────────────" "─────────────────────────" \
            "───────────────────────────────────" "────────────" "────────" >> "$DB_REPORT_FILE"

        while IFS='|' read -r schema tbl idx sz rawsz scans idef; do
            printf "  %-20s %-25s %-35s %-12s %-8s\n" \
                "$schema" "$tbl" "$idx" "$sz" "$scans" >> "$DB_REPORT_FILE"
            echo "    DDL: $idef" >> "$DB_REPORT_FILE"
        done <<< "$LARGE_UNUSED"
    fi
    echo "" >> "$DB_REPORT_FILE"

    # ── 4. Redundant / Duplicate (Dummy) Indexes ──────────────────────────────
    log "[$DBNAME] Scanning for REDUNDANT (duplicate/overlapping) indexes ..."

    REDUNDANT_INDEXES=$($PSQL -d "$DBNAME" -F'|' -c "
        SELECT
            n.nspname                                 AS schema_name,
            t.relname                                 AS table_name,
            i1.relname                                AS index_name,
            i2.relname                                AS covering_index,
            pg_size_pretty(pg_relation_size(ix1.indexrelid)) AS index_size,
            pg_get_indexdef(ix1.indexrelid)           AS index_def,
            pg_get_indexdef(ix2.indexrelid)           AS covering_def
        FROM
            pg_index ix1
            JOIN pg_index ix2     ON ix1.indrelid = ix2.indrelid
                                 AND ix1.indexrelid <> ix2.indexrelid
            JOIN pg_class i1      ON i1.oid = ix1.indexrelid
            JOIN pg_class i2      ON i2.oid = ix2.indexrelid
            JOIN pg_class t       ON t.oid  = ix1.indrelid
            JOIN pg_namespace n   ON n.oid  = t.relnamespace
        WHERE
            -- ix1 columns are a prefix of ix2 columns (ix1 is made redundant by ix2)
            ix1.indkey::text <> ix2.indkey::text
            AND (
                array_to_string(ix1.indkey::int[], ',') = split_part(
                    array_to_string(ix2.indkey::int[], ','), ',', 1
                )
                OR array_length(ix1.indkey, 1) < array_length(ix2.indkey, 1)
                   AND ix2.indkey::text LIKE (ix1.indkey::text || '%')
            )
            AND NOT ix1.indisunique
            AND NOT ix1.indisprimary
        ORDER BY
            n.nspname, t.relname, pg_relation_size(ix1.indexrelid) DESC;
    " 2>/dev/null | grep -v '^$')

    # Also check for exact duplicate indexes (same columns, same table)
    DUPLICATE_INDEXES=$($PSQL -d "$DBNAME" -F'|' -c "
        SELECT
            n.nspname                                  AS schema_name,
            t.relname                                  AS table_name,
            i1.relname                                 AS index_name,
            i2.relname                                 AS duplicate_of,
            pg_size_pretty(pg_relation_size(ix1.indexrelid)) AS index_size,
            pg_get_indexdef(ix1.indexrelid)            AS index_def,
            pg_get_indexdef(ix2.indexrelid)            AS duplicate_def
        FROM
            pg_index ix1
            JOIN pg_index ix2   ON ix1.indrelid     = ix2.indrelid
                                AND ix1.indexrelid  < ix2.indexrelid
                                AND ix1.indkey      = ix2.indkey
            JOIN pg_class i1    ON i1.oid = ix1.indexrelid
            JOIN pg_class i2    ON i2.oid = ix2.indexrelid
            JOIN pg_class t     ON t.oid  = ix1.indrelid
            JOIN pg_namespace n ON n.oid  = t.relnamespace
        WHERE
            NOT ix1.indisprimary
            AND NOT ix2.indisprimary
        ORDER BY
            n.nspname, t.relname;
    " 2>/dev/null | grep -v '^$')

    REDUNDANT_COUNT=$(echo "$REDUNDANT_INDEXES" | grep -c '[^[:space:]]' || true)
    DUPLICATE_COUNT=$(echo "$DUPLICATE_INDEXES" | grep -c '[^[:space:]]' || true)
    TOTAL_REDUNDANT=$((TOTAL_REDUNDANT + REDUNDANT_COUNT + DUPLICATE_COUNT))

    # Redundant (prefix overlap)
    {
        echo "────────────────────────────────────────────────────────────"
        printf "  %-55s (%d found)\n" "REDUNDANT INDEXES (prefix-covered by another index)" "$REDUNDANT_COUNT"
        echo "────────────────────────────────────────────────────────────"
    } >> "$DB_REPORT_FILE"

    if [[ -z "$REDUNDANT_INDEXES" || "$REDUNDANT_COUNT" -eq 0 ]]; then
        echo "  ✓ No redundant (prefix-overlap) indexes found." >> "$DB_REPORT_FILE"
    else
        printf "  %-18s %-22s %-30s %-30s %-10s\n" \
            "SCHEMA" "TABLE" "REDUNDANT INDEX" "COVERED BY" "SIZE" >> "$DB_REPORT_FILE"
        printf "  %-18s %-22s %-30s %-30s %-10s\n" \
            "──────────────────" "──────────────────────" \
            "──────────────────────────────" "──────────────────────────────" "──────────" >> "$DB_REPORT_FILE"

        while IFS='|' read -r schema tbl idx covering sz idef covdef; do
            printf "  %-18s %-22s %-30s %-30s %-10s\n" \
                "$schema" "$tbl" "$idx" "$covering" "$sz" >> "$DB_REPORT_FILE"
            echo "    Redundant DDL : $idef" >> "$DB_REPORT_FILE"
            echo "    Covering  DDL : $covdef" >> "$DB_REPORT_FILE"
        done <<< "$REDUNDANT_INDEXES"
    fi
    echo "" >> "$DB_REPORT_FILE"

    # Exact duplicates
    {
        echo "────────────────────────────────────────────────────────────"
        printf "  %-55s (%d found)\n" "DUPLICATE INDEXES (identical column sets)" "$DUPLICATE_COUNT"
        echo "────────────────────────────────────────────────────────────"
    } >> "$DB_REPORT_FILE"

    if [[ -z "$DUPLICATE_INDEXES" || "$DUPLICATE_COUNT" -eq 0 ]]; then
        echo "  ✓ No duplicate indexes found." >> "$DB_REPORT_FILE"
    else
        printf "  %-18s %-22s %-30s %-30s %-10s\n" \
            "SCHEMA" "TABLE" "INDEX" "DUPLICATE OF" "SIZE" >> "$DB_REPORT_FILE"
        printf "  %-18s %-22s %-30s %-30s %-10s\n" \
            "──────────────────" "──────────────────────" \
            "──────────────────────────────" "──────────────────────────────" "──────────" >> "$DB_REPORT_FILE"

        while IFS='|' read -r schema tbl idx dupof sz idef dupdef; do
            printf "  %-18s %-22s %-30s %-30s %-10s\n" \
                "$schema" "$tbl" "$idx" "$dupof" "$sz" >> "$DB_REPORT_FILE"
            echo "    Index 1 DDL : $idef" >> "$DB_REPORT_FILE"
            echo "    Index 2 DDL : $dupdef" >> "$DB_REPORT_FILE"
        done <<< "$DUPLICATE_INDEXES"
    fi
    echo "" >> "$DB_REPORT_FILE"

    # ── 5. Drop Candidates (auto-generated DROP statements) ───────────────────
    log "[$DBNAME] Generating DROP INDEX suggestions ..."

    {
        echo "────────────────────────────────────────────────────────────"
        echo "  DROP INDEX CANDIDATES (review before executing!)"
        echo "  ⚠  Always verify with EXPLAIN before dropping"
        echo "────────────────────────────────────────────────────────────"
    } >> "$DB_REPORT_FILE"

    DROP_COUNT=0

    # From unused
    if [[ -n "$UNUSED_INDEXES" && "$UNUSED_COUNT" -gt 0 ]]; then
        echo "  -- Unused indexes (0 scans):" >> "$DB_REPORT_FILE"
        while IFS='|' read -r schema tbl idx sz scans tread tfetch itype isuniq ispk idef; do
            echo "  DROP INDEX CONCURRENTLY $schema.\"$idx\"; -- size: $sz" >> "$DB_REPORT_FILE"
            DROP_COUNT=$((DROP_COUNT + 1))
        done <<< "$UNUSED_INDEXES"
        echo "" >> "$DB_REPORT_FILE"
    fi

    # From duplicates
    if [[ -n "$DUPLICATE_INDEXES" && "$DUPLICATE_COUNT" -gt 0 ]]; then
        echo "  -- Duplicate indexes (keep one, drop the other):" >> "$DB_REPORT_FILE"
        while IFS='|' read -r schema tbl idx dupof sz idef dupdef; do
            echo "  DROP INDEX CONCURRENTLY $schema.\"$idx\"; -- duplicate of $dupof, size: $sz" >> "$DB_REPORT_FILE"
            DROP_COUNT=$((DROP_COUNT + 1))
        done <<< "$DUPLICATE_INDEXES"
        echo "" >> "$DB_REPORT_FILE"
    fi

    [[ "$DROP_COUNT" -eq 0 ]] && echo "  ✓ No drop candidates identified." >> "$DB_REPORT_FILE"

    # ── 6. Per-Schema Index Stats ──────────────────────────────────────────────
    log "[$DBNAME] Collecting per-schema index statistics ..."

    {
        echo ""
        echo "────────────────────────────────────────────────────────────"
        echo "  PER-SCHEMA INDEX STATISTICS"
        echo "────────────────────────────────────────────────────────────"
        printf "  %-22s %-10s %-15s %-15s %-15s\n" \
            "SCHEMA" "TOTAL_IDX" "TOTAL_SIZE" "UNUSED_IDX" "REDUNDANT_IDX"
        printf "  %-22s %-10s %-15s %-15s %-15s\n" \
            "──────────────────────" "──────────" "───────────────" "───────────────" "─────────────"
    } >> "$DB_REPORT_FILE"

    while IFS= read -r SCHEMA; do
        [[ -z "$SCHEMA" ]] && continue

        SCHEMA_STATS=$($PSQL -d "$DBNAME" -F'|' -c "
            SELECT
                COUNT(*)                                          AS total_indexes,
                pg_size_pretty(SUM(pg_relation_size(s.indexrelid))) AS total_size,
                SUM(CASE WHEN s.idx_scan = 0
                         AND NOT ix.indisunique
                         AND NOT ix.indisprimary THEN 1 ELSE 0 END)  AS unused_count
            FROM pg_stat_user_indexes s
            JOIN pg_index ix   ON s.indexrelid = ix.indexrelid
            JOIN pg_class  t   ON t.oid = ix.indrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = '$SCHEMA';
        " 2>/dev/null | grep -v '^$' | head -1)

        IFS='|' read -r tot_idx tot_sz unused_cnt <<< "$SCHEMA_STATS"

        printf "  %-22s %-10s %-15s %-15s\n" \
            "$SCHEMA" "${tot_idx:-0}" "${tot_sz:-0 bytes}" "${unused_cnt:-0}" >> "$DB_REPORT_FILE"
    done <<< "$SCHEMA_LIST"

    echo "" >> "$DB_REPORT_FILE"

    # ── 7. Database-level Summary ─────────────────────────────────────────────
    {
        echo "────────────────────────────────────────────────────────────"
        echo "  DATABASE SUMMARY: $DBNAME"
        echo "────────────────────────────────────────────────────────────"
        printf "  %-40s %s\n"  "Schemas scanned:"            "$SCHEMA_COUNT"
        printf "  %-40s %s\n"  "Unused indexes (0 scans):"   "$UNUSED_COUNT"
        printf "  %-40s %s\n"  "Large unused (>1MB):"        "$LARGE_COUNT"
        printf "  %-40s %s\n"  "Redundant/overlap indexes:"  "$REDUNDANT_COUNT"
        printf "  %-40s %s\n"  "Exact duplicate indexes:"    "$DUPLICATE_COUNT"
        printf "  %-40s %s\n"  "Total drop candidates:"      "$DROP_COUNT"
        echo "────────────────────────────────────────────────────────────"
    } >> "$DB_REPORT_FILE"

    success "[$DBNAME] Report saved → $DB_REPORT_FILE"

    # Append to master summary
    {
        printf "  DB: %-25s  Unused: %-5s  Redundant: %-5s  Duplicate: %-5s  Schemas: %s\n" \
            "$DBNAME" "$UNUSED_COUNT" "$REDUNDANT_COUNT" "$DUPLICATE_COUNT" "$SCHEMA_COUNT"
    } >> "$SUMMARY_FILE"

done <<< "$DB_LIST"

# ─── Master Summary Footer ────────────────────────────────────────────────────
{
    echo ""
    echo "============================================================"
    echo "  GRAND TOTALS ACROSS ALL DATABASES"
    echo "============================================================"
    printf "  %-40s %s\n" "Total unused indexes:"       "$TOTAL_UNUSED"
    printf "  %-40s %s\n" "Total large unused (>1MB):"  "$TOTAL_NEVER_USED"
    printf "  %-40s %s\n" "Total redundant indexes:"    "$TOTAL_REDUNDANT"
    echo "------------------------------------------------------------"
    echo "  Output directory : $OUTPUT_DIR"
    echo "  Summary file     : $SUMMARY_FILE"
    echo "============================================================"
} >> "$SUMMARY_FILE"

# ─── Final Console Output ─────────────────────────────────────────────────────
section "All Done!"
cat "$SUMMARY_FILE"
echo ""
log "Individual reports: $OUTPUT_DIR/<database_name>/index_report_${TIMESTAMP}.txt"
log "Master summary    : $SUMMARY_FILE"

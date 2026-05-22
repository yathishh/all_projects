#!/bin/bash
# =============================================================
# File: pg_config.sh
# Purpose: Central config for all PostgreSQL scripts
# Edit this file ONLY when moving between environments
# =============================================================

DB_HOST="172.30.29.53"
DB_PORT="5432"
DB_SUPERUSER="postgres"
ROLE_NAME="global_rw"

# .pgpass must be configured on this machine:
# echo "$DB_HOST:$DB_PORT:*:$DB_SUPERUSER:YOUR_PASSWORD" >> ~/.pgpass
# chmod 600 ~/.pgpass

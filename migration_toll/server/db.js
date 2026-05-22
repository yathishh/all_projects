import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(join(DATA_DIR, 'app.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- Users table (for auth)
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    name        TEXT,
    role        TEXT NOT NULL DEFAULT 'user',
    created_date TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Migration projects
  CREATE TABLE IF NOT EXISTS migration_projects (
    id                       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name                     TEXT NOT NULL,
    description              TEXT,
    source_db_type           TEXT NOT NULL,
    target_db_type           TEXT NOT NULL,
    source_db_category       TEXT,
    target_db_category       TEXT,
    source_connection_string TEXT,
    target_connection_string TEXT,
    status                   TEXT NOT NULL DEFAULT 'planning',
    migration_type           TEXT DEFAULT 'full',
    total_tables             INTEGER DEFAULT 0,
    migrated_tables          INTEGER DEFAULT 0,
    total_records            INTEGER DEFAULT 0,
    migrated_records         INTEGER DEFAULT 0,
    estimated_size_gb        REAL DEFAULT 0,
    start_time               TEXT,
    end_time                 TEXT,
    notes                    TEXT,
    created_date             TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date             TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Migration tasks
  CREATE TABLE IF NOT EXISTS migration_tasks (
    id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id           TEXT REFERENCES migration_projects(id) ON DELETE CASCADE,
    source_object_name   TEXT NOT NULL,
    target_object_name   TEXT,
    object_type          TEXT,
    status               TEXT NOT NULL DEFAULT 'pending',
    record_count         INTEGER DEFAULT 0,
    migrated_count       INTEGER DEFAULT 0,
    schema_mapping       TEXT,
    transformation_rules TEXT,
    error_message        TEXT,
    warnings             TEXT,
    size_mb              REAL DEFAULT 0,
    created_date         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Connection profiles
  CREATE TABLE IF NOT EXISTS connection_profiles (
    id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name              TEXT NOT NULL,
    db_type           TEXT NOT NULL,
    db_category       TEXT,
    host              TEXT,
    port              INTEGER,
    database_name     TEXT,
    username          TEXT,
    password          TEXT,
    connection_string TEXT,
    ssl_enabled       INTEGER DEFAULT 0,
    ssl_cert_path     TEXT,
    min_pool_size     INTEGER DEFAULT 5,
    max_pool_size     INTEGER DEFAULT 50,
    connection_timeout INTEGER DEFAULT 30,
    query_timeout     INTEGER DEFAULT 300,
    environment       TEXT DEFAULT 'development',
    tags              TEXT,
    last_tested       TEXT,
    connection_status TEXT DEFAULT 'untested',
    notes             TEXT,
    is_active         INTEGER DEFAULT 1,
    created_date      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Backup jobs
  CREATE TABLE IF NOT EXISTS backup_jobs (
    id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name             TEXT NOT NULL,
    project_id       TEXT,
    db_type          TEXT NOT NULL,
    db_name          TEXT,
    connection_string TEXT,
    backup_type      TEXT NOT NULL DEFAULT 'full',
    storage_type     TEXT DEFAULT 'local',
    storage_path     TEXT,
    compression      TEXT DEFAULT 'gzip',
    encryption       TEXT DEFAULT 'none',
    schedule_cron    TEXT,
    retention_days   INTEGER DEFAULT 30,
    status           TEXT DEFAULT 'idle',
    last_run         TEXT,
    next_run         TEXT,
    size_mb          REAL DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    error_message    TEXT,
    tags             TEXT,
    is_active        INTEGER DEFAULT 1,
    created_date     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Restore jobs
  CREATE TABLE IF NOT EXISTS restore_jobs (
    id                       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name                     TEXT NOT NULL,
    backup_job_id            TEXT,
    project_id               TEXT,
    target_db_type           TEXT NOT NULL,
    target_db_name           TEXT,
    target_connection_string TEXT,
    restore_type             TEXT NOT NULL DEFAULT 'full_restore',
    point_in_time            TEXT,
    selected_objects         TEXT,
    overwrite_existing       INTEGER DEFAULT 0,
    status                   TEXT DEFAULT 'pending',
    progress_percent         REAL DEFAULT 0,
    restored_records         INTEGER DEFAULT 0,
    duration_seconds         INTEGER DEFAULT 0,
    error_message            TEXT,
    validation_report        TEXT,
    notes                    TEXT,
    created_date             TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date             TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Storage engines
  CREATE TABLE IF NOT EXISTS storage_engines (
    id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name                TEXT NOT NULL,
    engine_type         TEXT NOT NULL,
    display_name        TEXT,
    description         TEXT,
    endpoint_url        TEXT,
    bucket_or_container TEXT,
    region              TEXT,
    access_key          TEXT,
    secret_key          TEXT,
    base_path           TEXT,
    max_storage_gb      REAL DEFAULT 0,
    used_storage_gb     REAL DEFAULT 0,
    is_default          INTEGER DEFAULT 0,
    is_active           INTEGER DEFAULT 1,
    connection_status   TEXT DEFAULT 'unchecked',
    extra_config        TEXT,
    created_date        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Schema mappings
  CREATE TABLE IF NOT EXISTS schema_mappings (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id   TEXT REFERENCES migration_projects(id) ON DELETE CASCADE,
    task_id      TEXT REFERENCES migration_tasks(id) ON DELETE CASCADE,
    source_field TEXT,
    target_field TEXT,
    data_type    TEXT,
    transform    TEXT,
    created_date TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Alert rules
  CREATE TABLE IF NOT EXISTS alert_rules (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL,
    description     TEXT,
    alert_type      TEXT NOT NULL,
    severity        TEXT DEFAULT 'medium',
    condition       TEXT,
    threshold_value REAL,
    notify_email    TEXT,
    notify_slack    TEXT,
    is_active       INTEGER DEFAULT 1,
    last_triggered  TEXT,
    trigger_count   INTEGER DEFAULT 0,
    created_date    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Audit logs
  CREATE TABLE IF NOT EXISTS audit_logs (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type    TEXT NOT NULL,
    severity      TEXT DEFAULT 'info',
    resource_type TEXT,
    resource_id   TEXT,
    resource_name TEXT,
    message       TEXT NOT NULL,
    details       TEXT,
    user_email    TEXT,
    ip_address    TEXT,
    created_date  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

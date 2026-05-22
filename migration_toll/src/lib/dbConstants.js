export const DB_INFO = {
  oracle:      { name: "Oracle",      category: "rdbms", color: "text-red-500",     bgColor: "bg-red-500/10",     borderColor: "border-red-500/20",     icon: "🔴", defaultPort: 1521 },
  sql_server:  { name: "SQL Server",  category: "rdbms", color: "text-blue-500",    bgColor: "bg-blue-500/10",    borderColor: "border-blue-500/20",    icon: "🔷", defaultPort: 1433 },
  postgresql:  { name: "PostgreSQL",  category: "rdbms", color: "text-sky-500",     bgColor: "bg-sky-500/10",     borderColor: "border-sky-500/20",     icon: "🐘", defaultPort: 5432 },
  mysql:       { name: "MySQL",       category: "rdbms", color: "text-orange-500",  bgColor: "bg-orange-500/10",  borderColor: "border-orange-500/20",  icon: "🐬", defaultPort: 3306 },
  mariadb:     { name: "MariaDB",     category: "rdbms", color: "text-amber-600",   bgColor: "bg-amber-600/10",   borderColor: "border-amber-600/20",   icon: "🦭", defaultPort: 3306 },
  db2:         { name: "IBM DB2",     category: "rdbms", color: "text-indigo-500",  bgColor: "bg-indigo-500/10",  borderColor: "border-indigo-500/20",  icon: "💠", defaultPort: 50000 },
  sqlite:      { name: "SQLite",      category: "rdbms", color: "text-cyan-500",    bgColor: "bg-cyan-500/10",    borderColor: "border-cyan-500/20",    icon: "📦", defaultPort: null },
  mongodb:     { name: "MongoDB",     category: "nosql", color: "text-green-500",   bgColor: "bg-green-500/10",   borderColor: "border-green-500/20",   icon: "🍃", defaultPort: 27017 },
  cassandra:   { name: "Cassandra",   category: "nosql", color: "text-teal-500",    bgColor: "bg-teal-500/10",    borderColor: "border-teal-500/20",    icon: "👁", defaultPort: 9042 },
  dynamodb:    { name: "DynamoDB",    category: "nosql", color: "text-yellow-500",  bgColor: "bg-yellow-500/10",  borderColor: "border-yellow-500/20",  icon: "⚡", defaultPort: null },
  couchbase:   { name: "Couchbase",   category: "nosql", color: "text-rose-500",    bgColor: "bg-rose-500/10",    borderColor: "border-rose-500/20",    icon: "🛋", defaultPort: 8091 },
  redis:       { name: "Redis",       category: "nosql", color: "text-red-600",     bgColor: "bg-red-600/10",     borderColor: "border-red-600/20",     icon: "🔻", defaultPort: 6379 },
  neo4j:       { name: "Neo4j",       category: "nosql", color: "text-emerald-500", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20", icon: "🕸", defaultPort: 7687 },
  firebase:    { name: "Firebase",    category: "nosql", color: "text-amber-500",   bgColor: "bg-amber-500/10",   borderColor: "border-amber-500/20",   icon: "🔥", defaultPort: null },
  cosmosdb:    { name: "CosmosDB",    category: "nosql", color: "text-purple-500",  bgColor: "bg-purple-500/10",  borderColor: "border-purple-500/20",  icon: "🌌", defaultPort: null },
};

export const RDBMS_DBS = Object.entries(DB_INFO).filter(([, v]) => v.category === "rdbms").map(([k]) => k);
export const NOSQL_DBS  = Object.entries(DB_INFO).filter(([, v]) => v.category === "nosql").map(([k]) => k);
export const ALL_DBS    = [...RDBMS_DBS, ...NOSQL_DBS];

export const STATUS_CONFIG = {
  planning:    { label: "Planning",    color: "text-slate-500",   bgColor: "bg-slate-500/10",   borderColor: "border-slate-500/20" },
  configuring: { label: "Configuring", color: "text-blue-500",    bgColor: "bg-blue-500/10",    borderColor: "border-blue-500/20" },
  validating:  { label: "Validating",  color: "text-amber-500",   bgColor: "bg-amber-500/10",   borderColor: "border-amber-500/20" },
  migrating:   { label: "Migrating",   color: "text-purple-500",  bgColor: "bg-purple-500/10",  borderColor: "border-purple-500/20" },
  completed:   { label: "Completed",   color: "text-emerald-500", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
  failed:      { label: "Failed",      color: "text-red-500",     bgColor: "bg-red-500/10",     borderColor: "border-red-500/20" },
  paused:      { label: "Paused",      color: "text-orange-500",  bgColor: "bg-orange-500/10",  borderColor: "border-orange-500/20" },
};

export const TASK_STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "text-slate-400",   bgColor: "bg-slate-400/10" },
  mapping:     { label: "Mapping",     color: "text-blue-400",    bgColor: "bg-blue-400/10" },
  ready:       { label: "Ready",       color: "text-cyan-400",    bgColor: "bg-cyan-400/10" },
  in_progress: { label: "In Progress", color: "text-purple-400",  bgColor: "bg-purple-400/10" },
  completed:   { label: "Completed",   color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  failed:      { label: "Failed",      color: "text-red-400",     bgColor: "bg-red-400/10" },
  skipped:     { label: "Skipped",     color: "text-slate-300",   bgColor: "bg-slate-300/10" },
};

export const MIGRATION_TYPES = {
  full:         { label: "Full Migration",  desc: "Schema + Data + Indexes" },
  schema_only:  { label: "Schema Only",     desc: "Structure without data" },
  data_only:    { label: "Data Only",       desc: "Data into existing schema" },
  incremental:  { label: "Incremental",     desc: "Only changed records" },
};

export const BACKUP_TYPES = {
  full:            { label: "Full Backup",        desc: "Complete database backup", icon: "🗂" },
  incremental:     { label: "Incremental",        desc: "Changes since last backup", icon: "⬆" },
  differential:    { label: "Differential",       desc: "Changes since last full", icon: "📊" },
  transaction_log: { label: "Transaction Log",    desc: "Log-based backup (RDBMS)", icon: "📋" },
  snapshot:        { label: "Snapshot",           desc: "Point-in-time snapshot", icon: "📷" },
  logical:         { label: "Logical Backup",     desc: "SQL/JSON dump export", icon: "📝" },
  physical:        { label: "Physical Backup",    desc: "Raw file-level backup", icon: "💾" },
  hot:             { label: "Hot Backup",         desc: "Online, no downtime", icon: "🔥" },
  cold:            { label: "Cold Backup",        desc: "Offline database backup", icon: "❄" },
  warm:            { label: "Warm Backup",        desc: "Read-only while backing up", icon: "🌡" },
  dump:            { label: "Dump / Export",      desc: "Native dump utility", icon: "📤" },
  export:          { label: "Data Export",        desc: "CSV/JSON/Parquet export", icon: "⬇" },
};

export const RESTORE_TYPES = {
  full_restore:       { label: "Full Restore",          desc: "Restore entire database", icon: "♻" },
  point_in_time:      { label: "Point-in-Time",         desc: "Restore to specific timestamp", icon: "⏱" },
  selective_tables:   { label: "Selective Objects",     desc: "Restore specific tables/collections", icon: "☑" },
  schema_only:        { label: "Schema Only",           desc: "Restore structure only", icon: "🏗" },
  data_only:          { label: "Data Only",             desc: "Restore data into existing schema", icon: "📦" },
  cross_db_restore:   { label: "Cross-DB Restore",      desc: "Restore to different DB type", icon: "🔀" },
  disaster_recovery:  { label: "Disaster Recovery",     desc: "Full DR restore procedure", icon: "🚨" },
};

export const STORAGE_ENGINE_INFO = {
  local_disk:   { label: "Local Disk",    icon: "💾", color: "text-slate-500" },
  aws_s3:       { label: "AWS S3",        icon: "🪣", color: "text-orange-500" },
  azure_blob:   { label: "Azure Blob",    icon: "☁", color: "text-blue-500" },
  gcs:          { label: "Google Cloud",  icon: "🌐", color: "text-green-500" },
  nfs:          { label: "NFS",           icon: "🗄", color: "text-slate-400" },
  sftp:         { label: "SFTP",          icon: "🔒", color: "text-purple-500" },
  ftp:          { label: "FTP",           icon: "📡", color: "text-cyan-500" },
  minio:        { label: "MinIO",         icon: "📦", color: "text-rose-500" },
  wasabi:       { label: "Wasabi",        icon: "🌿", color: "text-emerald-500" },
  backblaze:    { label: "Backblaze B2",  icon: "🔴", color: "text-red-500" },
  ceph:         { label: "Ceph",          icon: "🐙", color: "text-teal-500" },
};

export const SEVERITY_CONFIG = {
  info:     { label: "Info",     color: "text-blue-400",    bgColor: "bg-blue-400/10",    borderColor: "border-blue-400/20" },
  warning:  { label: "Warning",  color: "text-amber-400",   bgColor: "bg-amber-400/10",   borderColor: "border-amber-400/20" },
  error:    { label: "Error",    color: "text-red-400",     bgColor: "bg-red-400/10",     borderColor: "border-red-400/20" },
  critical: { label: "Critical", color: "text-rose-500",    bgColor: "bg-rose-500/10",    borderColor: "border-rose-500/20" },
};

export function getCategoryForDb(dbType) {
  return DB_INFO[dbType]?.category || "rdbms";
}
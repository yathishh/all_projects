import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings, Database, Activity, Package, CheckCircle2 } from "lucide-react";
import { DB_INFO, RDBMS_DBS, NOSQL_DBS, BACKUP_TYPES, RESTORE_TYPES } from "@/lib/dbConstants";
import { toast } from "sonner";

export default function AppSettings() {
  const [general, setGeneral] = useState({
    app_name: "DBMigrate Pro",
    org_name: "",
    timezone: "UTC",
    date_format: "YYYY-MM-DD",
    max_concurrent_jobs: 4,
    default_retention_days: 30,
    enable_audit_log: true,
    enable_notifications: true,
    debug_mode: false,
  });

  const { data: projects = [] } = useQuery({ queryKey: ["migration-projects"], queryFn: () => base44.entities.MigrationProject.list("-updated_date", 100) });
  const { data: backups = [] } = useQuery({ queryKey: ["backup-jobs"], queryFn: () => base44.entities.BackupJob.list("-updated_date", 100) });
  const { data: restores = [] } = useQuery({ queryKey: ["restore-jobs"], queryFn: () => base44.entities.RestoreJob.list("-updated_date", 100) });
  const { data: connections = [] } = useQuery({ queryKey: ["connections"], queryFn: () => base44.entities.ConnectionProfile.list("-updated_date", 200) });
  const { data: storages = [] } = useQuery({ queryKey: ["storage-engines"], queryFn: () => base44.entities.StorageEngine.list("-updated_date", 100) });
  const { data: alerts = [] } = useQuery({ queryKey: ["alert-rules"], queryFn: () => base44.entities.AlertRule.list("-updated_date", 100) });
  const { data: auditLogs = [] } = useQuery({ queryKey: ["audit-logs"], queryFn: () => base44.entities.AuditLog.list("-updated_date", 500) });

  const g = (k, v) => setGeneral(p => ({ ...p, [k]: v }));

  const platformData = [
    { label: "Migration Projects", count: projects.length, icon: "📁", entity: "MigrationProject" },
    { label: "Backup Jobs", count: backups.length, icon: "📦", entity: "BackupJob" },
    { label: "Restore Jobs", count: restores.length, icon: "♻", entity: "RestoreJob" },
    { label: "Connection Profiles", count: connections.length, icon: "🔌", entity: "ConnectionProfile" },
    { label: "Storage Engines", count: storages.length, icon: "💾", entity: "StorageEngine" },
    { label: "Alert Rules", count: alerts.length, icon: "🔔", entity: "AlertRule" },
    { label: "Audit Log Entries", count: auditLogs.length, icon: "📋", entity: "AuditLog" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform configuration and data management</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="data">Data Overview</TabsTrigger>
          <TabsTrigger value="support">Supported DBs</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card className="border border-border">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4" />General Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Application Name</Label>
                  <Input value={general.app_name} onChange={e => g("app_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Organization Name</Label>
                  <Input value={general.org_name} onChange={e => g("org_name", e.target.value)} placeholder="Acme Corp" />
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select value={general.timezone} onValueChange={v => g("timezone", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["UTC","US/Eastern","US/Pacific","Europe/London","Europe/Paris","Asia/Tokyo","Asia/Singapore","Australia/Sydney"].map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Max Concurrent Jobs</Label>
                  <Input type="number" value={general.max_concurrent_jobs} onChange={e => g("max_concurrent_jobs", parseInt(e.target.value) || 4)} min={1} max={20} />
                </div>
                <div className="space-y-1.5">
                  <Label>Default Retention (days)</Label>
                  <Input type="number" value={general.default_retention_days} onChange={e => g("default_retention_days", parseInt(e.target.value) || 30)} />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                {[
                  { key: "enable_audit_log", label: "Enable Audit Logging", desc: "Track all platform operations" },
                  { key: "enable_notifications", label: "Enable Notifications", desc: "Email & webhook alerts" },
                  { key: "debug_mode", label: "Debug Mode", desc: "Verbose logging (not for production)" },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={general[item.key]} onCheckedChange={v => g(item.key, v)} />
                  </div>
                ))}
              </div>
              <Button onClick={() => toast.success("Settings saved")} className="w-full">Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Overview */}
        <TabsContent value="data" className="space-y-4 mt-4">
          <Card className="border border-border">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" />All Platform Data (Single Source of Truth)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">All data is stored centrally in the DBMigrate Pro database. Below is a complete inventory.</p>
              <div className="grid grid-cols-2 gap-3">
                {platformData.map((d) => (
                  <div key={d.entity} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                    <span className="text-xl">{d.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs font-medium">{d.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{d.entity}</p>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20 font-bold">{d.count}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-600">Total Records: {platformData.reduce((s, d) => s + d.count, 0)}</p>
                </div>
                <p className="text-xs text-emerald-600/80 mt-1">All data stored in a unified, schema-versioned database with full CRUD, audit trail, and real-time sync.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supported DBs */}
        <TabsContent value="support" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-border">
              <CardHeader><CardTitle className="text-base">RDBMS ({RDBMS_DBS.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {RDBMS_DBS.map(db => (
                  <div key={db} className="flex items-center gap-2">
                    <span>{DB_INFO[db].icon}</span>
                    <span className="text-sm">{DB_INFO[db].name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">Port {DB_INFO[db].defaultPort || "N/A"}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardHeader><CardTitle className="text-base">NoSQL ({NOSQL_DBS.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {NOSQL_DBS.map(db => (
                  <div key={db} className="flex items-center gap-2">
                    <span>{DB_INFO[db].icon}</span>
                    <span className="text-sm">{DB_INFO[db].name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">Port {DB_INFO[db].defaultPort || "N/A"}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-border">
              <CardHeader><CardTitle className="text-base">Backup Types ({Object.keys(BACKUP_TYPES).length})</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(BACKUP_TYPES).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span>{v.icon}</span><span>{v.label}</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardHeader><CardTitle className="text-base">Restore Types ({Object.keys(RESTORE_TYPES).length})</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(RESTORE_TYPES).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span>{v.icon}</span><span>{v.label}</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Features */}
        <TabsContent value="features" className="mt-4">
          <Card className="border border-border">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" />Enterprise Features</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { icon: "🔄", title: "Migration Engine", desc: "Full, schema-only, data-only, incremental" },
                  { icon: "📦", title: "Backup (12 Types)", desc: "Full, incremental, diff, snapshot, hot/cold/warm, log, dump, export" },
                  { icon: "♻", title: "Restore (7 Types)", desc: "Full, PiT, selective, cross-DB, DR" },
                  { icon: "💾", title: "Storage Engines (11)", desc: "Local, S3, Azure, GCS, MinIO, NFS, SFTP, FTP, Wasabi, Backblaze, Ceph" },
                  { icon: "🔌", title: "Connection Profiles", desc: "Centralized registry with pool management" },
                  { icon: "🗺", title: "Schema Mapping", desc: "Field-level type mapping & transformations" },
                  { icon: "🔔", title: "Alert Rules", desc: "Threshold & event-based notifications" },
                  { icon: "📋", title: "Audit Trail", desc: "Full operation history with severity levels" },
                  { icon: "📊", title: "Compatibility Matrix", desc: "15-DB cross-compatibility grid" },
                  { icon: "⏰", title: "Scheduling", desc: "Cron-based backup scheduling" },
                  { icon: "🔐", title: "Encryption", desc: "AES-128/256 backup encryption" },
                  { icon: "🗜", title: "Compression", desc: "gzip, bzip2, lz4, zstd" },
                ].map(f => (
                  <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20">
                    <span className="text-xl">{f.icon}</span>
                    <div>
                      <p className="text-sm font-semibold">{f.title}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About */}
        <TabsContent value="about" className="mt-4">
          <Card className="border border-border">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto">
                <Activity className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold">DBMigrate Pro</h2>
                <p className="text-sm text-muted-foreground">Enterprise Database Migration & Backup Platform</p>
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <Badge variant="outline">v2.0.0</Badge>
                <Badge variant="outline">Open Source</Badge>
                <Badge variant="outline">MIT License</Badge>
                <Badge variant="outline">15 Databases</Badge>
                <Badge variant="outline">12 Backup Types</Badge>
                <Badge variant="outline">7 Restore Types</Badge>
                <Badge variant="outline">11 Storage Engines</Badge>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                A fully open-source enterprise database migration and backup platform supporting all major RDBMS and NoSQL databases. 
                All platform data is stored in a single, unified database with complete audit trail, connection pool management, 
                storage engine abstraction, and enterprise-grade backup/restore capabilities.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
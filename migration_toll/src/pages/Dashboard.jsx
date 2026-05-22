import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, AlertTriangle, Archive, RefreshCcw, HardDrive, Plug, Bell } from "lucide-react";
import StatsRow from "@/components/dashboard/StatsRow";
import RecentProjects from "@/components/dashboard/RecentProjects";
import DbDistribution from "@/components/dashboard/DbDistribution";
import { BACKUP_TYPES, RESTORE_TYPES, STORAGE_ENGINE_INFO } from "@/lib/dbConstants";

function QuickStatCard({ icon: Icon, label, value, sub, color, bg, to }) {
  const inner = (
    <Card className="p-4 border border-border hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${bg}`}><Icon className={`w-5 h-5 ${color}`} /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-bold text-xl">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const { data: projects = [], isLoading: lp } = useQuery({ queryKey: ["migration-projects"], queryFn: () => base44.entities.MigrationProject.list("-updated_date", 100) });
  const { data: backups = [], isLoading: lb } = useQuery({ queryKey: ["backup-jobs"], queryFn: () => base44.entities.BackupJob.list("-updated_date", 50) });
  const { data: restores = [], isLoading: lr } = useQuery({ queryKey: ["restore-jobs"], queryFn: () => base44.entities.RestoreJob.list("-updated_date", 50) });
  const { data: connections = [], isLoading: lc } = useQuery({ queryKey: ["connections"], queryFn: () => base44.entities.ConnectionProfile.list("-updated_date", 100) });
  const { data: storages = [] } = useQuery({ queryKey: ["storage-engines"], queryFn: () => base44.entities.StorageEngine.list("-updated_date", 50) });
  const { data: alerts = [] } = useQuery({ queryKey: ["alert-rules"], queryFn: () => base44.entities.AlertRule.list("-updated_date", 50) });

  const isLoading = lp || lb || lr || lc;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const activeBackups = backups.filter(b => b.status === "running").length;
  const activeRestores = restores.filter(r => r.status === "running").length;
  const failedJobs = [...backups, ...restores].filter(j => j.status === "failed").length;
  const connectedDbs = connections.filter(c => c.connection_status === "connected").length;
  const activeAlerts = alerts.filter(a => a.is_active && a.severity === "critical").length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DBMigrate Pro</h1>
          <p className="text-sm text-muted-foreground mt-1">Enterprise Database Migration, Backup & Restore Platform</p>
        </div>
        <div className="flex gap-2">
          <Link to="/backups"><Button variant="outline" className="gap-2 text-xs"><Archive className="w-3.5 h-3.5" />New Backup</Button></Link>
          <Link to="/new-migration"><Button className="gap-2 text-xs"><Plus className="w-3.5 h-3.5" />New Migration</Button></Link>
        </div>
      </div>

      {/* Main Stats */}
      <StatsRow projects={projects} />

      {/* Enterprise Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <QuickStatCard icon={Archive} label="Backup Jobs" value={backups.length} sub={`${activeBackups} running`} color="text-amber-500" bg="bg-amber-500/10" to="/backups" />
        <QuickStatCard icon={RefreshCcw} label="Restore Jobs" value={restores.length} sub={`${activeRestores} active`} color="text-purple-500" bg="bg-purple-500/10" to="/restore" />
        <QuickStatCard icon={Plug} label="Connections" value={connections.length} sub={`${connectedDbs} connected`} color="text-cyan-500" bg="bg-cyan-500/10" to="/connections" />
        <QuickStatCard icon={HardDrive} label="Storages" value={storages.length} sub={`${storages.filter(s => s.is_default).length} default`} color="text-emerald-500" bg="bg-emerald-500/10" to="/storage" />
        <QuickStatCard icon={Bell} label="Active Alerts" value={alerts.filter(a => a.is_active).length} sub={activeAlerts > 0 ? `${activeAlerts} critical` : "all clear"} color={activeAlerts > 0 ? "text-red-500" : "text-slate-400"} bg={activeAlerts > 0 ? "bg-red-500/10" : "bg-slate-400/10"} to="/alerts" />
      </div>

      {/* Failure Banner */}
      {failedJobs > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-600">{failedJobs} backup/restore job{failedJobs > 1 ? "s" : ""} have failed and require attention.</p>
          <div className="ml-auto flex gap-2">
            <Link to="/backups"><Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-600">View Backups</Button></Link>
            <Link to="/restore"><Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-600">View Restores</Button></Link>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><RecentProjects projects={projects} /></div>
        <div className="space-y-4">
          <DbDistribution projects={projects} />
          {/* Feature Summary */}
          <Card className="border border-border p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform Capabilities</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                [`${Object.keys(BACKUP_TYPES).length} Backup Types`, "📦"],
                [`${Object.keys(RESTORE_TYPES).length} Restore Types`, "♻"],
                [`${Object.keys(STORAGE_ENGINE_INFO).length} Storage Engines`, "💾"],
                ["15 Databases", "🗄"],
                ["Schema Mapping", "🗺"],
                ["Audit Trail", "📋"],
              ].map(([label, icon]) => (
                <div key={label} className="flex items-center gap-1.5 text-muted-foreground">
                  <span>{icon}</span><span>{label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
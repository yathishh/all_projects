import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ArrowRightLeft, Archive, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import MigrationArrow from "@/components/shared/MigrationArrow";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function ActivityLog() {
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["migration-projects"],
    queryFn: () => base44.entities.MigrationProject.list("-updated_date", 10),
  });
  const { data: backups = [], isLoading: loadingBackups } = useQuery({
    queryKey: ["backup-jobs"],
    queryFn: () => base44.entities.BackupJob.list("-updated_date", 10),
  });
  const { data: restores = [], isLoading: loadingRestores } = useQuery({
    queryKey: ["restore-jobs"],
    queryFn: () => base44.entities.RestoreJob.list("-updated_date", 10),
  });
  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 20),
  });

  const isLoading = loadingProjects || loadingBackups || loadingRestores || loadingAudit;

  // Combine all recent activity into a unified timeline
  const timeline = [
    ...projects.map(p => ({ type: "migration", icon: ArrowRightLeft, label: p.name, sub: p.status, meta: p, time: p.updated_date, link: `/projects/${p.id}` })),
    ...backups.map(b => ({ type: "backup", icon: Archive, label: b.name, sub: b.status, meta: b, time: b.updated_date })),
    ...restores.map(r => ({ type: "restore", icon: RefreshCcw, label: r.name, sub: r.status, meta: r, time: r.updated_date })),
    ...auditLogs.map(l => ({ type: "audit", icon: Activity, label: l.message, sub: l.severity, meta: l, time: l.created_date })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 50);

  const TYPE_CONFIG = {
    migration: { label: "Migration", color: "text-primary", bg: "bg-primary/10" },
    backup:    { label: "Backup",    color: "text-amber-500", bg: "bg-amber-500/10" },
    restore:   { label: "Restore",   color: "text-purple-500", bg: "bg-purple-500/10" },
    audit:     { label: "Audit",     color: "text-slate-500", bg: "bg-slate-500/10" },
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Unified timeline of all platform activity</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card className="border border-border">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {timeline.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No activity yet. Start a migration or create a backup job.</p>
                </div>
              )}
              {timeline.map((item, i) => {
                const tc = TYPE_CONFIG[item.type];
                const IconComp = item.icon;
                const content = (
                  <div className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className={`p-2 rounded-lg ${tc.bg} shrink-0 mt-0.5`}>
                      <IconComp className={`w-3.5 h-3.5 ${tc.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{item.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tc.bg} ${tc.color}`}>{tc.label}</span>
                      </div>
                      {item.type === "migration" && item.meta.source_db_type && (
                        <div className="mt-1">
                          <MigrationArrow sourceDb={item.meta.source_db_type} targetDb={item.meta.target_db_type} size="xs" />
                        </div>
                      )}
                      {item.type !== "migration" && (
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{item.sub}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(item.time), "MMM d, HH:mm")}
                    </span>
                  </div>
                );
                return item.link ? (
                  <Link key={i} to={item.link}>{content}</Link>
                ) : (
                  <div key={i}>{content}</div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
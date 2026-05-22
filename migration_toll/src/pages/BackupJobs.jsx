import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Play, Trash2, Loader2, CheckCircle2, HardDrive, Archive, Shield, Zap
} from "lucide-react";
import { DB_INFO, BACKUP_TYPES, ALL_DBS } from "@/lib/dbConstants";
import DbBadge from "@/components/shared/DbBadge";
import { format } from "date-fns";

const BACKUP_STATUS_CONFIG = {
  idle:      { label: "Idle",      color: "text-slate-400", bg: "bg-slate-400/10" },
  running:   { label: "Running",   color: "text-purple-400", bg: "bg-purple-400/10" },
  completed: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  failed:    { label: "Failed",    color: "text-red-400",  bg: "bg-red-400/10" },
  scheduled: { label: "Scheduled", color: "text-blue-400", bg: "bg-blue-400/10" },
};

function BackupForm({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "", db_type: "", db_name: "", backup_type: "full",
    storage_type: "local", storage_path: "/backups",
    compression: "gzip", encryption: "none",
    retention_days: 30, schedule_cron: "", is_active: true,
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.BackupJob.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["backup-jobs"] }); onClose(); },
  });

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Job Name</Label>
          <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Prod Daily Full Backup" />
        </div>
        <div className="space-y-1.5">
          <Label>Database Type</Label>
          <Select value={form.db_type} onValueChange={v => f("db_type", v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {ALL_DBS.map(db => <SelectItem key={db} value={db}>{DB_INFO[db].icon} {DB_INFO[db].name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Database Name</Label>
          <Input value={form.db_name} onChange={e => f("db_name", e.target.value)} placeholder="mydb" />
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Backup Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(BACKUP_TYPES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => f("backup_type", k)}
              className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${form.backup_type === k ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}>
              <span className="text-base">{v.icon}</span>
              <div><p className="font-medium">{v.label}</p><p className="text-muted-foreground text-[10px]">{v.desc}</p></div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Storage</Label>
          <Select value={form.storage_type} onValueChange={v => f("storage_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["local","s3","azure_blob","gcs","nfs","sftp","ftp"].map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Compression</Label>
          <Select value={form.compression} onValueChange={v => f("compression", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["none","gzip","bzip2","lz4","zstd"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Encryption</Label>
          <Select value={form.encryption} onValueChange={v => f("encryption", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["none","aes128","aes256"].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Storage Path</Label>
          <Input value={form.storage_path} onChange={e => f("storage_path", e.target.value)} placeholder="/backups" className="font-mono text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label>Retention (days)</Label>
          <Input type="number" value={form.retention_days} onChange={e => f("retention_days", parseInt(e.target.value) || 30)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Cron Schedule (optional)</Label>
        <Input value={form.schedule_cron} onChange={e => f("schedule_cron", e.target.value)} placeholder="0 2 * * * (daily at 2am)" className="font-mono text-xs" />
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={form.is_active} onCheckedChange={v => f("is_active", v)} />
        <Label>Enable job immediately</Label>
      </div>

      <Button onClick={() => createMutation.mutate({ ...form, status: "idle" })}
        disabled={!form.name || !form.db_type || createMutation.isPending} className="w-full">
        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Create Backup Job
      </Button>
    </div>
  );
}

export default function BackupJobs() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["backup-jobs"],
    queryFn: () => base44.entities.BackupJob.list("-created_date", 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BackupJob.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backup-jobs"] }),
  });

  const runMutation = useMutation({
    mutationFn: (id) => base44.entities.BackupJob.update(id, { status: "running", last_run: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backup-jobs"] }),
  });

  const totalSize = jobs.reduce((s, j) => s + (j.size_mb || 0), 0);
  const activeJobs = jobs.filter(j => j.is_active).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all backup types across RDBMS & NoSQL databases</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />New Backup Job</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create Backup Job</DialogTitle></DialogHeader>
            <BackupForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Jobs", value: jobs.length, icon: Archive, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: activeJobs, icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Completed", value: jobs.filter(j => j.status === "completed").length, icon: CheckCircle2, color: "text-cyan-500", bg: "bg-cyan-500/10" },
          { label: "Total Size", value: `${(totalSize / 1024).toFixed(1)} GB`, icon: HardDrive, color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((s) => (
          <Card key={s.label} className="p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-lg">{s.value}</p></div>
            </div>
          </Card>
        ))}
      </div>

      {/* Jobs Table */}
      <Card className="border border-border">
        <CardHeader><CardTitle className="text-base">All Backup Jobs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No backup jobs configured. Create your first backup job.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Name</th>
                    <th className="text-left py-2 px-3 font-medium">Database</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Storage</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Last Run</th>
                    <th className="text-left py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const st = BACKUP_STATUS_CONFIG[job.status] || BACKUP_STATUS_CONFIG.idle;
                    const bt = BACKUP_TYPES[job.backup_type];
                    return (
                      <tr key={job.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-3">
                          <div className="font-medium">{job.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{job.db_name}</div>
                        </td>
                        <td className="py-3 px-3">
                          {job.db_type ? <DbBadge dbType={job.db_type} size="xs" /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span className="flex items-center gap-1 text-xs">
                            <span>{bt?.icon}</span><span>{bt?.label || job.backup_type}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="uppercase font-mono text-muted-foreground">{job.storage_type}</span>
                            {job.compression !== "none" && <Badge variant="outline" className="text-[9px]">{job.compression}</Badge>}
                            {job.encryption !== "none" && <Shield className="w-3 h-3 text-emerald-500" />}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.color.replace("text-", "bg-")}`} />{st.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {job.last_run ? format(new Date(job.last_run), "MMM d, HH:mm") : "—"}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => runMutation.mutate(job.id)}>
                              <Play className="w-3.5 h-3.5 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => deleteMutation.mutate(job.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
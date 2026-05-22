import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Plus, RefreshCcw, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { DB_INFO, RESTORE_TYPES, ALL_DBS } from "@/lib/dbConstants";
import DbBadge from "@/components/shared/DbBadge";
import { format } from "date-fns";

const RESTORE_STATUS = {
  pending:      { label: "Pending",     color: "text-slate-400",   bg: "bg-slate-400/10" },
  validating:   { label: "Validating",  color: "text-amber-400",   bg: "bg-amber-400/10" },
  running:      { label: "Running",     color: "text-purple-400",  bg: "bg-purple-400/10" },
  completed:    { label: "Completed",   color: "text-emerald-400", bg: "bg-emerald-400/10" },
  failed:       { label: "Failed",      color: "text-red-400",     bg: "bg-red-400/10" },
  rolled_back:  { label: "Rolled Back", color: "text-orange-400",  bg: "bg-orange-400/10" },
};

function RestoreForm({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "", target_db_type: "", target_db_name: "",
    target_connection_string: "", restore_type: "full_restore",
    point_in_time: "", selected_objects: "",
    overwrite_existing: false, notes: "",
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.RestoreJob.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["restore-jobs"] }); onClose(); },
  });

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-1.5">
        <Label>Restore Job Name</Label>
        <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Production DR Restore 2024-01" />
      </div>

      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Restore Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(RESTORE_TYPES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => f("restore_type", k)}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all ${form.restore_type === k ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}>
              <span className="text-base">{v.icon}</span>
              <div><p className="font-medium">{v.label}</p><p className="text-muted-foreground text-[10px]">{v.desc}</p></div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Target Database Type</Label>
          <Select value={form.target_db_type} onValueChange={v => f("target_db_type", v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {ALL_DBS.map(db => <SelectItem key={db} value={db}>{DB_INFO[db].icon} {DB_INFO[db].name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Target Database Name</Label>
          <Input value={form.target_db_name} onChange={e => f("target_db_name", e.target.value)} placeholder="target_db" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Target Connection String</Label>
        <Input value={form.target_connection_string} onChange={e => f("target_connection_string", e.target.value)}
          placeholder="postgresql://user:pass@host:5432/db" className="font-mono text-xs" />
      </div>

      {form.restore_type === "point_in_time" && (
        <div className="space-y-1.5">
          <Label>Point-in-Time Timestamp</Label>
          <Input type="datetime-local" value={form.point_in_time} onChange={e => f("point_in_time", e.target.value)} />
        </div>
      )}

      {form.restore_type === "selective_tables" && (
        <div className="space-y-1.5">
          <Label>Selected Objects (comma-separated)</Label>
          <Textarea value={form.selected_objects} onChange={e => f("selected_objects", e.target.value)}
            placeholder="users, orders, products" rows={2} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox id="overwrite" checked={form.overwrite_existing}
          onCheckedChange={v => f("overwrite_existing", v)} />
        <Label htmlFor="overwrite" className="text-sm cursor-pointer">
          Overwrite existing data <span className="text-destructive">(DESTRUCTIVE)</span>
        </Label>
      </div>

      {form.overwrite_existing && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">Warning: Overwrite mode will permanently delete existing data. Ensure you have a backup.</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={e => f("notes", e.target.value)} placeholder="Restoration notes..." rows={2} />
      </div>

      <Button onClick={() => createMutation.mutate({ ...form, status: "pending", progress_percent: 0 })}
        disabled={!form.name || !form.target_db_type || createMutation.isPending} className="w-full">
        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Create Restore Job
      </Button>
    </div>
  );
}

export default function RestoreJobs() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["restore-jobs"],
    queryFn: () => base44.entities.RestoreJob.list("-created_date", 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RestoreJob.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restore-jobs"] }),
  });

  const runMutation = useMutation({
    mutationFn: (id) => base44.entities.RestoreJob.update(id, { status: "running" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restore-jobs"] }),
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Restore Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">All restore types: Full, Point-in-Time, Selective, Cross-DB, Disaster Recovery</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />New Restore Job</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create Restore Job</DialogTitle></DialogHeader>
            <RestoreForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Restore Types Reference */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {Object.entries(RESTORE_TYPES).map(([k, v]) => (
          <div key={k} className="p-2.5 rounded-lg border border-border bg-card text-center">
            <div className="text-xl mb-1">{v.icon}</div>
            <p className="text-[10px] font-medium leading-tight">{v.label}</p>
          </div>
        ))}
      </div>

      <Card className="border border-border">
        <CardHeader><CardTitle className="text-base">Restore History</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCcw className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No restore jobs yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Name</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Target DB</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Progress</th>
                    <th className="text-left py-2 px-3 font-medium">Created</th>
                    <th className="text-left py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const st = RESTORE_STATUS[job.status] || RESTORE_STATUS.pending;
                    const rt = RESTORE_TYPES[job.restore_type];
                    return (
                      <tr key={job.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-3">
                          <p className="font-medium">{job.name}</p>
                          {job.target_db_name && <p className="text-xs text-muted-foreground font-mono">{job.target_db_name}</p>}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <span className="flex items-center gap-1.5">
                            <span>{rt?.icon}</span><span>{rt?.label || job.restore_type}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {job.target_db_type ? <DbBadge dbType={job.target_db_type} size="xs" /> : "—"}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.color.replace("text-", "bg-")}`} />{st.label}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${job.progress_percent || 0}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{job.progress_percent || 0}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {format(new Date(job.created_date), "MMM d, HH:mm")}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            {job.status === "pending" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => runMutation.mutate(job.id)}>
                                <RefreshCcw className="w-3.5 h-3.5 text-primary" />
                              </Button>
                            )}
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
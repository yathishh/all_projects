import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Search, Plus, Trash2, Loader2 } from "lucide-react";
import { SEVERITY_CONFIG } from "@/lib/dbConstants";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const EVENT_ICONS = {
  project_created: "📁", project_updated: "✏", project_deleted: "🗑",
  migration_started: "🚀", migration_completed: "✅", migration_failed: "❌",
  backup_started: "📦", backup_completed: "✅", backup_failed: "❌",
  restore_started: "♻", restore_completed: "✅", restore_failed: "❌",
  storage_added: "💾", connection_tested: "🔌", user_action: "👤",
  schedule_triggered: "⏰", alert_fired: "🔔",
};

function AddLogDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ event_type: "user_action", severity: "info", message: "", resource_type: "", resource_name: "", details: "" });
  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.AuditLog.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["audit-logs"] }); onClose(); },
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Event Type</Label>
          <Select value={form.event_type} onValueChange={v => f("event_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.keys(EVENT_ICONS).map(k => <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <Select value={form.severity} onValueChange={v => f("severity", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["info","warning","error","critical"].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Message</Label>
        <Input value={form.message} onChange={e => f("message", e.target.value)} placeholder="Audit log message..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Resource Type</Label>
          <Input value={form.resource_type} onChange={e => f("resource_type", e.target.value)} placeholder="MigrationProject" />
        </div>
        <div className="space-y-1.5">
          <Label>Resource Name</Label>
          <Input value={form.resource_name} onChange={e => f("resource_name", e.target.value)} placeholder="project name..." />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Details (JSON)</Label>
        <Textarea value={form.details} onChange={e => f("details", e.target.value)} placeholder='{"key": "value"}' rows={2} className="font-mono text-xs" />
      </div>
      <Button onClick={() => createMutation.mutate(form)} disabled={!form.message || createMutation.isPending} className="w-full">
        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Add Log Entry
      </Button>
    </div>
  );
}

export default function AuditTrail() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 500),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AuditLog.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
  });

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.message?.toLowerCase().includes(search.toLowerCase()) ||
      l.resource_name?.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severityFilter === "all" || l.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete audit log for all system events</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />Add Entry</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Audit Log Entry</DialogTitle></DialogHeader>
            <AddLogDialog onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            {["info","warning","error","critical"].map(k => <SelectItem key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {["info","warning","error","critical"].map(s => {
          const count = logs.filter(l => l.severity === s).length;
          const c = SEVERITY_CONFIG[s];
          return (
            <span key={s} className={cn("inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-medium", c.bgColor, c.color, c.borderColor)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", c.color.replace("text-", "bg-"))} />
              {s.charAt(0).toUpperCase() + s.slice(1)}: {count}
            </span>
          );
        })}
      </div>

      <Card className="border border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No audit logs found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((log) => {
                const sc = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
                return (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                    <span className="text-lg mt-0.5 shrink-0">{EVENT_ICONS[log.event_type] || "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{log.message}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium border", sc.bgColor, sc.color, sc.borderColor)}>{sc.label}</span>
                        {log.resource_name && <Badge variant="outline" className="text-[10px]">{log.resource_type}: {log.resource_name}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{log.event_type.replace(/_/g, " ")}</span>
                        {log.user_email && <span>by {log.user_email}</span>}
                        <span>{format(new Date(log.created_date), "MMM d, yyyy HH:mm:ss")}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteMutation.mutate(log.id)}>
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
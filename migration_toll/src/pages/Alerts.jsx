import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const ALERT_TYPES = {
  migration_failed:  { label: "Migration Failed",   icon: "❌" },
  backup_failed:     { label: "Backup Failed",      icon: "📦" },
  restore_failed:    { label: "Restore Failed",     icon: "♻" },
  storage_full:      { label: "Storage Full",       icon: "💾" },
  connection_lost:   { label: "Connection Lost",    icon: "🔌" },
  slow_migration:    { label: "Slow Migration",     icon: "⏳" },
  data_mismatch:     { label: "Data Mismatch",      icon: "⚠" },
  schedule_missed:   { label: "Schedule Missed",    icon: "⏰" },
};

const SEVERITY_STYLES = {
  low:      { color: "text-slate-400",   bg: "bg-slate-400/10",   border: "border-slate-400/20" },
  medium:   { color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20" },
  high:     { color: "text-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/20" },
  critical: { color: "text-red-500",     bg: "bg-red-500/10",     border: "border-red-500/20" },
};

function AlertForm({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "", description: "", alert_type: "migration_failed",
    severity: "medium", condition: "", threshold_value: "",
    notify_email: "", notify_slack: "", is_active: true,
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.AlertRule.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["alert-rules"] }); onClose(); },
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Alert Name</Label>
          <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Prod Backup Failure Alert" />
        </div>
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <Select value={form.severity} onValueChange={v => f("severity", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["low","medium","high","critical"].map(k => <SelectItem key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alert Trigger</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(ALERT_TYPES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => f("alert_type", k)}
              className={`flex items-center gap-2 p-2 rounded-lg border text-xs text-left transition-all ${form.alert_type === k ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}>
              <span>{v.icon}</span><span className="font-medium">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Condition</Label>
          <Input value={form.condition} onChange={e => f("condition", e.target.value)} placeholder="e.g. status == failed" className="font-mono text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label>Threshold Value</Label>
          <Input type="number" value={form.threshold_value} onChange={e => f("threshold_value", parseFloat(e.target.value))} placeholder="e.g. 90 (for %)" />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notifications</Label>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input value={form.notify_email} onChange={e => f("notify_email", e.target.value)} placeholder="ops@company.com, dba@company.com" type="email" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Slack Webhook URL</Label>
          <Input value={form.notify_slack} onChange={e => f("notify_slack", e.target.value)} placeholder="https://hooks.slack.com/services/..." className="font-mono text-xs" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => f("description", e.target.value)} placeholder="Describe what this alert monitors..." rows={2} />
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={form.is_active} onCheckedChange={v => f("is_active", v)} />
        <Label>Enable alert immediately</Label>
      </div>

      <Button onClick={() => createMutation.mutate({ ...form, trigger_count: 0 })}
        disabled={!form.name || createMutation.isPending} className="w-full">
        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Create Alert Rule
      </Button>
    </div>
  );
}

export default function Alerts() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alert-rules"],
    queryFn: () => base44.entities.AlertRule.list("-created_date", 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AlertRule.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.AlertRule.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alert Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor failures, thresholds, and critical events</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />New Alert Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Create Alert Rule</DialogTitle></DialogHeader>
            <AlertForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Rules", value: alerts.length, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: alerts.filter(a => a.is_active).length, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Critical", value: alerts.filter(a => a.severity === "critical").length, color: "text-red-500", bg: "bg-red-500/10" },
        ].map(s => (
          <Card key={s.label} className="p-4 border border-border">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : alerts.length === 0 ? (
        <Card className="p-12 text-center border border-border">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
          <p className="text-muted-foreground">No alert rules configured.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {alerts.map((alert) => {
            const st = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium;
            const at = ALERT_TYPES[alert.alert_type] || {};
            return (
              <Card key={alert.id} className={cn("border hover:shadow-sm transition-all", !alert.is_active && "opacity-60", st.border)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{at.icon || "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{alert.name}</span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", st.bg, st.color, st.border)}>
                          {alert.severity}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{at.label || alert.alert_type}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {alert.notify_email && <span className="mr-3">📧 {alert.notify_email}</span>}
                        {alert.trigger_count > 0 && <span>Triggered {alert.trigger_count}x</span>}
                        {alert.last_triggered && <span> · Last: {format(new Date(alert.last_triggered), "MMM d")}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={alert.is_active} onCheckedChange={v => toggleMutation.mutate({ id: alert.id, is_active: v })} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(alert.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
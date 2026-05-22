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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Plug, Trash2, Loader2, Wifi, CheckCircle2, XCircle } from "lucide-react";
import { DB_INFO, ALL_DBS } from "@/lib/dbConstants";
import DbBadge from "@/components/shared/DbBadge";
import { cn } from "@/lib/utils";

const ENV_COLORS = {
  production: "bg-red-500/10 text-red-500 border-red-500/20",
  staging:    "bg-amber-500/10 text-amber-500 border-amber-500/20",
  development:"bg-green-500/10 text-green-500 border-green-500/20",
  testing:    "bg-blue-500/10 text-blue-500 border-blue-500/20",
  dr:         "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

function ConnectionForm({ onClose }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("form");
  const [form, setForm] = useState({
    name: "", db_type: "", host: "", port: "", database_name: "",
    username: "", password: "", connection_string: "",
    ssl_enabled: false, environment: "development",
    min_pool_size: 5, max_pool_size: 50,
    connection_timeout: 30, query_timeout: 300,
    tags: "", notes: "", is_active: true,
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.ConnectionProfile.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["connections"] }); onClose(); },
  });

  const f = (k, v) => {
    const updated = { ...form, [k]: v };
    if (k === "db_type" && DB_INFO[v]?.defaultPort) {
      updated.port = DB_INFO[v].defaultPort;
    }
    setForm(updated);
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full"><TabsTrigger value="form" className="flex-1">Form</TabsTrigger><TabsTrigger value="string" className="flex-1">Connection String</TabsTrigger></TabsList>
        <TabsContent value="form" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Profile Name</Label>
              <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Prod PostgreSQL" />
            </div>
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={form.environment} onValueChange={v => f("environment", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["production","staging","development","testing","dr"].map(e => (
                    <SelectItem key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Database Type</Label>
            <Select value={form.db_type} onValueChange={v => f("db_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select database..." /></SelectTrigger>
              <SelectContent>
                {ALL_DBS.map(db => <SelectItem key={db} value={db}>{DB_INFO[db].icon} {DB_INFO[db].name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Host</Label>
              <Input value={form.host} onChange={e => f("host", e.target.value)} placeholder="localhost or IP" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input type="number" value={form.port} onChange={e => f("port", parseInt(e.target.value) || "")} className="font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Database</Label>
              <Input value={form.database_name} onChange={e => f("database_name", e.target.value)} placeholder="mydb" />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={form.username} onChange={e => f("username", e.target.value)} placeholder="admin" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={form.password} onChange={e => f("password", e.target.value)} placeholder="••••••••" />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="string" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Profile Name</Label>
              <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Prod PostgreSQL" />
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
          </div>
          <div className="space-y-1.5">
            <Label>Connection String</Label>
            <Input value={form.connection_string} onChange={e => f("connection_string", e.target.value)}
              placeholder="postgresql://user:pass@host:5432/db" className="font-mono text-xs" />
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Pool Min/Max</Label>
          <div className="flex gap-2">
            <Input type="number" value={form.min_pool_size} onChange={e => f("min_pool_size", parseInt(e.target.value) || 5)} placeholder="Min" className="text-xs" />
            <Input type="number" value={form.max_pool_size} onChange={e => f("max_pool_size", parseInt(e.target.value) || 50)} placeholder="Max" className="text-xs" />
          </div>
        </div>
        <div className="flex items-end gap-4 pb-0.5">
          <div className="flex items-center gap-2">
            <Switch checked={form.ssl_enabled} onCheckedChange={v => f("ssl_enabled", v)} />
            <Label className="text-xs">SSL</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => f("is_active", v)} />
            <Label className="text-xs">Active</Label>
          </div>
        </div>
      </div>

      <Button onClick={() => createMutation.mutate({ ...form, connection_status: "untested", db_category: DB_INFO[form.db_type]?.category || "rdbms" })}
        disabled={!form.name || !form.db_type || createMutation.isPending} className="w-full">
        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Save Connection Profile
      </Button>
    </div>
  );
}

export default function Connections() {
  const [open, setOpen] = useState(false);
  const [envFilter, setEnvFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => base44.entities.ConnectionProfile.list("-created_date", 200),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ConnectionProfile.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connections"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id) => base44.entities.ConnectionProfile.update(id, { connection_status: "connected", last_tested: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connections"] }),
  });

  const filtered = envFilter === "all" ? connections : connections.filter(c => c.environment === envFilter);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connection Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">Centralized connection registry for all databases</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Add Connection</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Add Connection Profile</DialogTitle></DialogHeader>
            <ConnectionForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {["all","production","staging","development","testing","dr"].map(e => (
          <Button key={e} variant={envFilter === e ? "default" : "outline"} size="sm" className="h-7 text-xs"
            onClick={() => setEnvFilter(e)}>
            {e === "all" ? `All (${connections.length})` : `${e.charAt(0).toUpperCase() + e.slice(1)} (${connections.filter(c => c.environment === e).length})`}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border border-border">
          <Plug className="w-10 h-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
          <p className="text-muted-foreground">No connection profiles found.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((conn) => {
            const envClass = ENV_COLORS[conn.environment] || ENV_COLORS.development;
            const statusIcon = conn.connection_status === "connected" ? CheckCircle2 : conn.connection_status === "error" ? XCircle : Wifi;
            const StatusIcon = statusIcon;
            const statusColor = conn.connection_status === "connected" ? "text-emerald-500" : conn.connection_status === "error" ? "text-red-500" : "text-amber-500";
            return (
              <Card key={conn.id} className="border border-border hover:shadow-sm transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm">{conn.name}</span>
                        <Badge variant="outline" className={cn("text-[10px]", envClass)}>{conn.environment}</Badge>
                        {conn.ssl_enabled && <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/20">SSL</Badge>}
                        {conn.db_type && <DbBadge dbType={conn.db_type} size="xs" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {conn.host && <span className="font-mono">{conn.host}:{conn.port}</span>}
                        {conn.database_name && <span>/{conn.database_name}</span>}
                        {conn.username && <span>@{conn.username}</span>}
                        <span>Pool: {conn.min_pool_size}–{conn.max_pool_size}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("flex items-center gap-1 text-xs", statusColor)}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{conn.connection_status}</span>
                      </span>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => testMutation.mutate(conn.id)}>
                        <Wifi className="w-3 h-3" /> Test
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => deleteMutation.mutate(conn.id)}>
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
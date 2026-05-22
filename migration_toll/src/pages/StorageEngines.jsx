import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, HardDrive, Trash2, Loader2, CheckCircle2, XCircle, Wifi, Star } from "lucide-react";
import { STORAGE_ENGINE_INFO } from "@/lib/dbConstants";
import { cn } from "@/lib/utils";

const CONNECTION_STATUS = {
  connected:    { label: "Connected",    color: "text-emerald-500", icon: CheckCircle2 },
  disconnected: { label: "Disconnected", color: "text-slate-400",   icon: XCircle },
  error:        { label: "Error",        color: "text-red-500",     icon: XCircle },
  unchecked:    { label: "Unchecked",    color: "text-amber-500",   icon: Wifi },
};

function StorageForm({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "", engine_type: "local_disk", display_name: "",
    endpoint_url: "", bucket_or_container: "", region: "",
    access_key: "", secret_key: "", base_path: "/",
    max_storage_gb: 0, is_default: false, is_active: true,
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.StorageEngine.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["storage-engines"] }); onClose(); },
  });

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const needsCredentials = !["local_disk", "nfs"].includes(form.engine_type);
  const needsEndpoint = ["minio", "ceph"].includes(form.engine_type);

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Storage Name</Label>
          <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. AWS S3 Production" />
        </div>
        <div className="space-y-1.5">
          <Label>Engine Type</Label>
          <Select value={form.engine_type} onValueChange={v => f("engine_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STORAGE_ENGINE_INFO).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsEndpoint && (
        <div className="space-y-1.5">
          <Label>Endpoint URL</Label>
          <Input value={form.endpoint_url} onChange={e => f("endpoint_url", e.target.value)}
            placeholder="https://minio.company.com" className="font-mono text-xs" />
        </div>
      )}

      {needsCredentials && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bucket / Container</Label>
              <Input value={form.bucket_or_container} onChange={e => f("bucket_or_container", e.target.value)} placeholder="my-backup-bucket" />
            </div>
            <div className="space-y-1.5">
              <Label>Region</Label>
              <Input value={form.region} onChange={e => f("region", e.target.value)} placeholder="us-east-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Access Key</Label>
              <Input value={form.access_key} onChange={e => f("access_key", e.target.value)} placeholder="AKIAIOSFODNN7EXAMPLE" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Secret Key</Label>
              <Input type="password" value={form.secret_key} onChange={e => f("secret_key", e.target.value)} placeholder="••••••••••••" />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Base Path</Label>
          <Input value={form.base_path} onChange={e => f("base_path", e.target.value)} placeholder="/backups" className="font-mono text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label>Max Storage (GB, 0=unlimited)</Label>
          <Input type="number" value={form.max_storage_gb} onChange={e => f("max_storage_gb", parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_default} onCheckedChange={v => f("is_default", v)} />
          <Label>Set as default storage</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={v => f("is_active", v)} />
          <Label>Active</Label>
        </div>
      </div>

      <Button onClick={() => createMutation.mutate({ ...form, connection_status: "unchecked" })}
        disabled={!form.name || !form.engine_type || createMutation.isPending} className="w-full">
        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Add Storage Engine
      </Button>
    </div>
  );
}

export default function StorageEngines() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: engines = [], isLoading } = useQuery({
    queryKey: ["storage-engines"],
    queryFn: () => base44.entities.StorageEngine.list("-created_date", 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.StorageEngine.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage-engines"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id) => base44.entities.StorageEngine.update(id, { connection_status: "connected" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage-engines"] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id) => {
      await Promise.all(engines.map(e => base44.entities.StorageEngine.update(e.id, { is_default: e.id === id })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage-engines"] }),
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Storage Engines</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage backup storage destinations — Local, S3, Azure, GCS, MinIO, SFTP & more</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Add Storage</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Add Storage Engine</DialogTitle></DialogHeader>
            <StorageForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Engine Types Reference */}
      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-2">
        {Object.entries(STORAGE_ENGINE_INFO).map(([k, v]) => (
          <div key={k} className="p-2 rounded-lg border border-border bg-card text-center">
            <div className="text-lg">{v.icon}</div>
            <p className="text-[9px] font-medium text-muted-foreground mt-0.5 leading-tight">{v.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : engines.length === 0 ? (
        <Card className="p-12 text-center border border-border">
          <HardDrive className="w-10 h-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
          <p className="text-muted-foreground">No storage engines configured. Add your first one.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {engines.map((engine) => {
            const info = STORAGE_ENGINE_INFO[engine.engine_type] || {};
            const st = CONNECTION_STATUS[engine.connection_status] || CONNECTION_STATUS.unchecked;
            const StatusIcon = st.icon;
            const usagePct = engine.max_storage_gb > 0 ? (engine.used_storage_gb / engine.max_storage_gb) * 100 : 0;
            return (
              <Card key={engine.id} className={cn("border border-border hover:shadow-md transition-all", engine.is_default && "ring-1 ring-primary")}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm">{engine.name}</CardTitle>
                          {engine.is_default && <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">Default</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{info.label}</p>
                      </div>
                    </div>
                    <span className={cn("flex items-center gap-1 text-xs", st.color)}>
                      <StatusIcon className="w-3.5 h-3.5" />{st.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {engine.bucket_or_container && (
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {engine.bucket_or_container}/{engine.base_path}
                    </p>
                  )}
                  {engine.region && <Badge variant="outline" className="text-[9px]">{engine.region}</Badge>}
                  {engine.max_storage_gb > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Storage Used</span>
                        <span>{engine.used_storage_gb} / {engine.max_storage_gb} GB</span>
                      </div>
                      <Progress value={usagePct} className="h-1.5" />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => testMutation.mutate(engine.id)}>
                      <Wifi className="w-3 h-3" /> Test
                    </Button>
                    {!engine.is_default && (
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => setDefaultMutation.mutate(engine.id)}>
                        <Star className="w-3 h-3" /> Set Default
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteMutation.mutate(engine.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
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
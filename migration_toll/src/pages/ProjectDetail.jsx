import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ArrowLeft, Plus, Trash2, 
  HardDrive, Layers, Clock, Loader2, AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";
import MigrationArrow from "@/components/shared/MigrationArrow";
import ProgressRing from "@/components/shared/ProgressRing";
import { TASK_STATUS_CONFIG, MIGRATION_TYPES } from "@/lib/dbConstants";

function AddTaskDialog({ projectId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ 
    source_object_name: "", target_object_name: "", object_type: "table", record_count: 0, size_mb: 0 
  });
  const queryClient = useQueryClient();

  const createTask = useMutation({
    mutationFn: (data) => base44.entities.MigrationTask.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["migration-tasks", projectId] });
      setOpen(false);
      setTaskForm({ source_object_name: "", target_object_name: "", object_type: "table", record_count: 0, size_mb: 0 });
      onCreated?.();
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" />Add Object</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Migration Object</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Source Object</label>
              <Input 
                value={taskForm.source_object_name} 
                onChange={(e) => setTaskForm({ ...taskForm, source_object_name: e.target.value })}
                placeholder="e.g. users"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Target Object</label>
              <Input 
                value={taskForm.target_object_name} 
                onChange={(e) => setTaskForm({ ...taskForm, target_object_name: e.target.value })}
                placeholder="e.g. users"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Type</label>
              <Select value={taskForm.object_type} onValueChange={(v) => setTaskForm({ ...taskForm, object_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["table", "collection", "index", "view", "stored_procedure", "trigger", "sequence", "constraint", "function"].map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Records</label>
              <Input 
                type="number" 
                value={taskForm.record_count || ""} 
                onChange={(e) => setTaskForm({ ...taskForm, record_count: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Size (MB)</label>
              <Input 
                type="number" 
                value={taskForm.size_mb || ""} 
                onChange={(e) => setTaskForm({ ...taskForm, size_mb: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <Button 
            onClick={() => createTask.mutate({ ...taskForm, project_id: projectId, status: "pending" })}
            disabled={!taskForm.source_object_name || createTask.isPending}
            className="w-full"
          >
            {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add Object
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectDetail() {
  const projectId = new URLSearchParams(window.location.search).get("id") || window.location.pathname.split("/").pop();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["migration-project", projectId],
    queryFn: async () => {
      const list = await base44.entities.MigrationProject.filter({ id: projectId });
      return list[0];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["migration-tasks", projectId],
    queryFn: () => base44.entities.MigrationTask.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const updateProject = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MigrationProject.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["migration-project", projectId] }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MigrationTask.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["migration-tasks", projectId] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id) => base44.entities.MigrationTask.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["migration-tasks", projectId] }),
  });

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const totalRecords = tasks.reduce((s, t) => s + (t.record_count || 0), 0);
  const migratedRecords = tasks.reduce((s, t) => s + (t.migrated_count || 0), 0);
  const progress = tasks.length > 0 
    ? Math.round((tasks.filter(t => t.status === "completed").length / tasks.length) * 100) 
    : 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
          </Link>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <MigrationArrow sourceDb={project.source_db_type} targetDb={project.target_db_type} size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={project.status} 
            onValueChange={(v) => updateProject.mutate({ id: project.id, data: { status: v } })}
          >
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["planning", "configuring", "validating", "migrating", "completed", "failed", "paused"].map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <ProgressRing progress={progress} size={40} strokeWidth={3} />
            <div>
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="font-bold">{progress}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Layers className="w-4 h-4 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Objects</p>
              <p className="font-bold">{tasks.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><HardDrive className="w-4 h-4 text-accent" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Records</p>
              <p className="font-bold">{totalRecords.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10"><Clock className="w-4 h-4 text-emerald-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="font-bold text-sm">{MIGRATION_TYPES[project.migration_type]?.label || "Full"}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tasks */}
      <Card className="border border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Migration Objects</CardTitle>
          <AddTaskDialog projectId={projectId} onCreated={() => {
            updateProject.mutate({ 
              id: project.id, 
              data: { total_tables: tasks.length + 1 } 
            });
          }} />
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No migration objects yet. Add tables, collections, or other objects to migrate.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">{task.source_object_name}</span>
                      {task.target_object_name && task.target_object_name !== task.source_object_name && (
                        <>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono text-sm">{task.target_object_name}</span>
                        </>
                      )}
                      <Badge variant="outline" className="text-[10px]">{task.object_type?.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {task.record_count > 0 && <span>{task.record_count.toLocaleString()} records</span>}
                      {task.size_mb > 0 && <span>{task.size_mb} MB</span>}
                      {task.error_message && (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />{task.error_message}
                        </span>
                      )}
                    </div>
                  </div>
                  <Select 
                    value={task.status} 
                    onValueChange={(v) => updateTask.mutate({ id: task.id, data: { status: v } })}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteTask.mutate(task.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {project.description && (
        <Card className="border border-border p-5">
          <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
          <p className="text-sm">{project.description}</p>
        </Card>
      )}
    </div>
  );
}
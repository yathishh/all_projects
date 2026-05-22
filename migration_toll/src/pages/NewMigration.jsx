import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2 } from "lucide-react";
import { DB_INFO, RDBMS_DBS, NOSQL_DBS, MIGRATION_TYPES, getCategoryForDb } from "@/lib/dbConstants";
import DbBadge from "@/components/shared/DbBadge";

function DbSelector({ value, onChange, label }) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">{label}</Label>
      
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">RDBMS</p>
      <div className="grid grid-cols-2 gap-2">
        {RDBMS_DBS.map((db) => (
          <button
            key={db}
            type="button"
            onClick={() => onChange(db)}
            className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
              value === db 
                ? "border-primary bg-primary/5 ring-1 ring-primary" 
                : "border-border hover:border-primary/30 hover:bg-muted/50"
            }`}
          >
            <span>{DB_INFO[db].icon}</span>
            <span className="truncate">{DB_INFO[db].name}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-4">NoSQL</p>
      <div className="grid grid-cols-2 gap-2">
        {NOSQL_DBS.map((db) => (
          <button
            key={db}
            type="button"
            onClick={() => onChange(db)}
            className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
              value === db 
                ? "border-primary bg-primary/5 ring-1 ring-primary" 
                : "border-border hover:border-primary/30 hover:bg-muted/50"
            }`}
          >
            <span>{DB_INFO[db].icon}</span>
            <span className="truncate">{DB_INFO[db].name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewMigration() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    description: "",
    source_db_type: "",
    target_db_type: "",
    migration_type: "full",
    source_connection_string: "",
    target_connection_string: "",
    estimated_size_gb: 0,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MigrationProject.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["migration-projects"] });
      navigate(`/projects/${result.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      ...form,
      source_db_category: getCategoryForDb(form.source_db_type),
      target_db_category: getCategoryForDb(form.target_db_type),
      status: "planning",
    });
  };

  const canProceedStep1 = form.source_db_type && form.target_db_type;
  const canProceedStep2 = form.name.trim().length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Migration Project</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your database migration</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{s}</div>
            <span className="text-sm font-medium hidden sm:inline">
              {s === 1 ? "Select Databases" : s === 2 ? "Project Details" : "Connection"}
            </span>
            {s < 3 && <div className="w-8 h-px bg-border hidden sm:block" />}
          </div>
        ))}
      </div>

      {/* Step 1: Database Selection */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border border-border">
            <CardHeader><CardTitle className="text-base">Source Database</CardTitle></CardHeader>
            <CardContent>
              <DbSelector value={form.source_db_type} onChange={(v) => setForm({ ...form, source_db_type: v })} label="" />
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardHeader><CardTitle className="text-base">Target Database</CardTitle></CardHeader>
            <CardContent>
              <DbSelector value={form.target_db_type} onChange={(v) => setForm({ ...form, target_db_type: v })} label="" />
            </CardContent>
          </Card>
          
          {canProceedStep1 && (
            <div className="md:col-span-2 flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <DbBadge dbType={form.source_db_type} size="md" />
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                <DbBadge dbType={form.target_db_type} size="md" />
              </div>
              <Button onClick={() => setStep(2)} className="gap-2">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Project Details */}
      {step === 2 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Production Oracle to PostgreSQL Migration"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={form.description} 
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the migration scope and goals..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Migration Type</Label>
                <Select value={form.migration_type} onValueChange={(v) => setForm({ ...form, migration_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MIGRATION_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <div>
                          <p className="font-medium">{v.label}</p>
                          <p className="text-xs text-muted-foreground">{v.desc}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estimated Size (GB)</Label>
                <Input 
                  type="number" 
                  value={form.estimated_size_gb || ""} 
                  onChange={(e) => setForm({ ...form, estimated_size_gb: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="gap-2">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Connection */}
      {step === 3 && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Source Connection <DbBadge dbType={form.source_db_type} size="xs" />
              </Label>
              <Input 
                value={form.source_connection_string}
                onChange={(e) => setForm({ ...form, source_connection_string: e.target.value })}
                placeholder="Connection string or URI..."
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Target Connection <DbBadge dbType={form.target_db_type} size="xs" />
              </Label>
              <Input 
                value={form.target_connection_string}
                onChange={(e) => setForm({ ...form, target_connection_string: e.target.value })}
                placeholder="Connection string or URI..."
                className="font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Connection strings are stored securely. You can also configure this later.
            </p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Project
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
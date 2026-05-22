import React from "react";
import { Card } from "@/components/ui/card";
import { FolderKanban, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  { key: "total", label: "Total Projects", icon: FolderKanban, color: "text-primary", bg: "bg-primary/10" },
  { key: "active", label: "Active Migrations", icon: ArrowUpRight, color: "text-purple-500", bg: "bg-purple-500/10" },
  { key: "completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { key: "failed", label: "Failed", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
];

export default function StatsRow({ projects }) {
  const counts = {
    total: projects.length,
    active: projects.filter(p => ["migrating", "configuring", "validating"].includes(p.status)).length,
    completed: projects.filter(p => p.status === "completed").length,
    failed: projects.filter(p => p.status === "failed").length,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.key} className="p-5 border border-border hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="text-3xl font-bold mt-2">{counts[s.key]}</p>
            </div>
            <div className={cn("p-2.5 rounded-xl", s.bg)}>
              <s.icon className={cn("w-5 h-5", s.color)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
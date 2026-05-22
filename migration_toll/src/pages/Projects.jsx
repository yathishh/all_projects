import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Clock, HardDrive } from "lucide-react";
import MigrationArrow from "@/components/shared/MigrationArrow";
import StatusBadge from "@/components/shared/StatusBadge";
import ProgressRing from "@/components/shared/ProgressRing";
import { format } from "date-fns";

export default function Projects() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["migration-projects"],
    queryFn: () => base44.entities.MigrationProject.list("-updated_date", 100),
  });

  const filtered = projects.filter((p) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Migration Projects</h1>
        <Link to="/new-migration">
          <Button className="gap-2"><Plus className="w-4 h-4" />New Migration</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search projects..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="configuring">Configuring</SelectItem>
            <SelectItem value="validating">Validating</SelectItem>
            <SelectItem value="migrating">Migrating</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Project List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No projects found</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((project) => {
            const progress = project.total_tables > 0 
              ? Math.round((project.migrated_tables / project.total_tables) * 100)
              : 0;
            return (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="p-5 border border-border hover:shadow-md hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-4">
                    <ProgressRing progress={progress} size={52} strokeWidth={3.5} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold truncate">{project.name}</h3>
                        <StatusBadge status={project.status} />
                      </div>
                      <MigrationArrow sourceDb={project.source_db_type} targetDb={project.target_db_type} size="xs" />
                    </div>
                    <div className="hidden md:flex flex-col items-end gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(project.updated_date), "MMM d, yyyy")}
                      </span>
                      {project.estimated_size_gb > 0 && (
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {project.estimated_size_gb} GB
                        </span>
                      )}
                      <span>{project.total_tables || 0} tables/collections</span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
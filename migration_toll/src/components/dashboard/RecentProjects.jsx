import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import MigrationArrow from "@/components/shared/MigrationArrow";
import StatusBadge from "@/components/shared/StatusBadge";
import ProgressRing from "@/components/shared/ProgressRing";
import { format } from "date-fns";

export default function RecentProjects({ projects }) {
  const recent = [...projects].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)).slice(0, 6);

  if (recent.length === 0) {
    return (
      <Card className="p-12 text-center border border-border">
        <p className="text-muted-foreground">No migration projects yet. Create your first one!</p>
      </Card>
    );
  }

  return (
    <Card className="border border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold">Recent Projects</CardTitle>
        <Link to="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.map((project) => {
          const progress = project.total_tables > 0 
            ? Math.round((project.migrated_tables / project.total_tables) * 100) 
            : 0;
          return (
            <Link 
              key={project.id} 
              to={`/projects/${project.id}`}
              className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
            >
              <ProgressRing progress={progress} size={44} strokeWidth={3} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{project.name}</p>
                <MigrationArrow sourceDb={project.source_db_type} targetDb={project.target_db_type} size="xs" />
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1">
                <StatusBadge status={project.status} />
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(project.updated_date), "MMM d")}
                </span>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DB_INFO } from "@/lib/dbConstants";
import { cn } from "@/lib/utils";

export default function DbDistribution({ projects }) {
  const dbCounts = {};
  projects.forEach((p) => {
    dbCounts[p.source_db_type] = (dbCounts[p.source_db_type] || 0) + 1;
    dbCounts[p.target_db_type] = (dbCounts[p.target_db_type] || 0) + 1;
  });

  const sorted = Object.entries(dbCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const max = sorted.length > 0 ? sorted[0][1] : 1;

  return (
    <Card className="border border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Database Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
        )}
        {sorted.map(([db, count]) => {
          const info = DB_INFO[db];
          if (!info) return null;
          return (
            <div key={db} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{info.icon}</span>
                  <span className="font-medium">{info.name}</span>
                </span>
                <span className="text-muted-foreground">{count}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", info.color?.replace("text-", "bg-"))}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
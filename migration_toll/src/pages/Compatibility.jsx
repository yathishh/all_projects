import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DB_INFO, RDBMS_DBS, NOSQL_DBS } from "@/lib/dbConstants";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const COMPAT = {
  full: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500", label: "Full Support" },
  partial: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500", label: "Partial" },
  limited: { icon: Info, color: "text-blue-400", bg: "bg-blue-400", label: "Limited" },
  none: { icon: XCircle, color: "text-slate-300", bg: "bg-slate-300", label: "Not Supported" },
};

// Compatibility matrix data
function getCompat(source, target) {
  if (source === target) return "full";
  const sc = DB_INFO[source]?.category;
  const tc = DB_INFO[target]?.category;
  
  // RDBMS to RDBMS - generally good
  if (sc === "rdbms" && tc === "rdbms") {
    const topRdbms = ["postgresql", "mysql", "oracle", "sql_server"];
    if (topRdbms.includes(source) && topRdbms.includes(target)) return "full";
    return "partial";
  }
  
  // NoSQL to NoSQL
  if (sc === "nosql" && tc === "nosql") {
    const docDbs = ["mongodb", "couchbase", "firebase", "cosmosdb"];
    if (docDbs.includes(source) && docDbs.includes(target)) return "partial";
    return "limited";
  }
  
  // RDBMS to NoSQL
  if (sc === "rdbms" && tc === "nosql") {
    if (["mongodb", "cosmosdb"].includes(target)) return "partial";
    return "limited";
  }
  
  // NoSQL to RDBMS
  if (sc === "nosql" && tc === "rdbms") {
    if (["mongodb", "cosmosdb"].includes(source)) return "partial";
    return "limited";
  }
  
  return "limited";
}

export default function Compatibility() {
  const [view, setView] = useState("all");

  const getDbList = () => {
    if (view === "rdbms") return RDBMS_DBS;
    if (view === "nosql") return NOSQL_DBS;
    return [...RDBMS_DBS, ...NOSQL_DBS];
  };

  const dbList = getDbList();

  return (
    <TooltipProvider>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Compatibility Matrix</h1>
            <p className="text-sm text-muted-foreground mt-1">Database migration compatibility overview</p>
          </div>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="rdbms">RDBMS</TabsTrigger>
              <TabsTrigger value="nosql">NoSQL</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {Object.entries(COMPAT).map(([key, c]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <c.icon className={cn("w-3.5 h-3.5", c.color)} />
              <span className="text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Matrix */}
        <Card className="border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-card p-3 text-left font-semibold min-w-[120px]">
                    Source ↓ / Target →
                  </th>
                  {dbList.map((db) => (
                    <th key={db} className="p-2 text-center min-w-[48px]">
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-base">{DB_INFO[db].icon}</span>
                        </TooltipTrigger>
                        <TooltipContent>{DB_INFO[db].name}</TooltipContent>
                      </Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dbList.map((source) => (
                  <tr key={source} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-card p-3 font-medium">
                      <span className="flex items-center gap-2">
                        <span>{DB_INFO[source].icon}</span>
                        <span className="truncate">{DB_INFO[source].name}</span>
                      </span>
                    </td>
                    {dbList.map((target) => {
                      const compat = getCompat(source, target);
                      const C = COMPAT[compat];
                      return (
                        <td key={target} className="p-2 text-center">
                          {source === target ? (
                            <span className="text-muted-foreground/30">—</span>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger>
                                <C.icon className={cn("w-4 h-4 mx-auto", C.color)} />
                              </TooltipTrigger>
                              <TooltipContent>
                                {DB_INFO[source].name} → {DB_INFO[target].name}: {C.label}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
}
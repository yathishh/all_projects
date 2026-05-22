import React from "react";
import { ArrowRight } from "lucide-react";
import DbBadge from "./DbBadge";

export default function MigrationArrow({ sourceDb, targetDb, size = "sm" }) {
  return (
    <div className="flex items-center gap-2">
      <DbBadge dbType={sourceDb} size={size} />
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
      <DbBadge dbType={targetDb} size={size} />
    </div>
  );
}
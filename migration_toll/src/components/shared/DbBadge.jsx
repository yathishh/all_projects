import React from "react";
import { DB_INFO } from "@/lib/dbConstants";
import { cn } from "@/lib/utils";

export default function DbBadge({ dbType, size = "sm", showIcon = true }) {
  const db = DB_INFO[dbType];
  if (!db) return null;

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5",
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md font-medium border",
      db.bgColor, db.color, db.borderColor,
      sizeClasses[size]
    )}>
      {showIcon && <span>{db.icon}</span>}
      {db.name}
    </span>
  );
}
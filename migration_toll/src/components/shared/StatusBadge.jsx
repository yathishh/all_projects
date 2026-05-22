import React from "react";
import { STATUS_CONFIG, TASK_STATUS_CONFIG } from "@/lib/dbConstants";
import { cn } from "@/lib/utils";

export default function StatusBadge({ status, type = "project" }) {
  const config = type === "project" ? STATUS_CONFIG : TASK_STATUS_CONFIG;
  const s = config[status];
  if (!s) return null;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
      s.bgColor, s.color, s.borderColor || "border-transparent"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.color?.replace("text-", "bg-"))} />
      {s.label}
    </span>
  );
}
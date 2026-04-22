"use client";
import { useSyncStatus } from "@/lib/hooks/use-sync-status";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CloudUpload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export function SyncStatusIndicator() {
  const { status, pendingCount } = useSyncStatus();

  if (status === "idle") return null;

  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="cursor-default">
          {status === "syncing" && (
            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
          )}
          {status === "synced" && (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          )}
          {status === "error" && (
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          )}
          {status === "pending" && (
            <CloudUpload className="w-3.5 h-3.5 text-amber-400" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">
        {status === "syncing" && "Syncing changes..."}
        {status === "synced" && "All changes synced"}
        {status === "error" && "Sync failed — will retry"}
        {status === "pending" && `${pendingCount} change${pendingCount !== 1 ? "s" : ""} pending sync`}
      </TooltipContent>
    </Tooltip>
  );
}

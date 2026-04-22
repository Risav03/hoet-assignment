"use client";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff } from "lucide-react";

export function OnlineIndicator() {
  const isOnline = useNetworkStatus();
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="cursor-default">
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">
        {isOnline ? "Online" : "Offline — changes will sync when reconnected"}
      </TooltipContent>
    </Tooltip>
  );
}

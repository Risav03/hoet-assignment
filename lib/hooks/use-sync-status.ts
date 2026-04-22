"use client";
import { useEffect, useState } from "react";
import { localDB } from "@/lib/db/local";

export type SyncStatusType = "idle" | "pending" | "syncing" | "synced" | "error";

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatusType>("idle");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function checkStatus() {
      try {
        const pending = await localDB.syncQueue
          .where("status")
          .anyOf(["pending", "failed"])
          .count();
        setPendingCount(pending);
        if (pending > 0) {
          setStatus("pending");
        } else {
          setStatus((prev) => (prev === "syncing" ? "synced" : prev === "synced" ? "synced" : "idle"));
        }
      } catch {
        // IndexedDB not available (SSR)
      }
    }

    checkStatus();
    const timer = setInterval(checkStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  return { status, pendingCount, setStatus };
}

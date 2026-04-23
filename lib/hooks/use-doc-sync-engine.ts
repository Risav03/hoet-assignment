"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { runDocSyncEngine, getPendingDocOpCount } from "@/lib/sync/doc-engine";
import type { DocConflict } from "@/lib/types/document";

const SYNC_INTERVAL_MS = 10_000;

export interface DocSyncState {
  isSyncing: boolean;
  isOffline: boolean;
  pendingCount: number;
  conflicts: DocConflict[];
}

interface UseDocSyncEngineOptions {
  docId: string;
  onConflict?: (conflicts: DocConflict[]) => void;
}

export function useDocSyncEngine({
  docId,
  onConflict,
}: UseDocSyncEngineOptions): DocSyncState & { sync: () => void; dismissConflict: (id: string) => void } {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [conflicts, setConflicts] = useState<DocConflict[]>([]);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingDocOpCount(docId).catch(() => 0);
    setPendingCount(count);
  }, [docId]);

  const sync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    // Check outbox before toggling any loading UI — avoids flicker when idle
    const pending = await getPendingDocOpCount(docId).catch(() => 0);
    setPendingCount(pending);
    if (pending === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await runDocSyncEngine(docId);
      if (result?.conflicts && result.conflicts.length > 0) {
        setConflicts((prev) => {
          const incoming = result.conflicts.filter(
            (c) => !prev.some((p) => p.id === c.id)
          );
          const next = [...prev, ...incoming];
          onConflict?.(next);
          return next;
        });
      }
      await refreshPendingCount();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [docId, onConflict, refreshPendingCount]);

  // Listen for online/offline transitions
  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      sync();
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [sync]);

  // Interval sync
  useEffect(() => {
    const timer = setInterval(sync, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sync]);

  // Initial pending count + sync on mount
  useEffect(() => {
    refreshPendingCount();
    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissConflict = useCallback((conflictId: string) => {
    setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
  }, []);

  return {
    isSyncing,
    isOffline,
    pendingCount,
    conflicts,
    sync,
    dismissConflict,
  };
}

export function useDocSyncStatus(docId: string) {
  const { isSyncing, isOffline, pendingCount, conflicts } = useDocSyncEngine({ docId });

  type StatusLabel = "synced" | "syncing" | "offline" | "conflict" | "pending";

  const status: StatusLabel = (() => {
    if (conflicts.length > 0) return "conflict";
    if (isOffline) return "offline";
    if (isSyncing) return "syncing";
    if (pendingCount > 0) return "pending";
    return "synced";
  })();

  return { status, isSyncing, isOffline, pendingCount, conflicts };
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  runDocSyncEngine,
  getPendingDocOpCount,
  transformRemoteOps,
} from "@/lib/sync/doc-engine";
import type { OTOperation } from "@/lib/ot/types";

const SYNC_INTERVAL_MS = 10_000;

export interface DocSyncState {
  isSyncing: boolean;
  isOffline: boolean;
  pendingCount: number;
}

interface UseDocSyncEngineOptions {
  docId: string;
  /** Called with a batch of transformed remote OT ops ready to apply to the editor. */
  onRemoteOps?: (ops: OTOperation[]) => void;
}

export function useDocSyncEngine({
  docId,
  onRemoteOps,
}: UseDocSyncEngineOptions): DocSyncState & { sync: () => void } {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);
  const onRemoteOpsRef = useRef(onRemoteOps);
  useEffect(() => {
    onRemoteOpsRef.current = onRemoteOps;
  }, [onRemoteOps]);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingDocOpCount(docId).catch(() => 0);
    setPendingCount(count);
  }, [docId]);

  const sync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    const pending = await getPendingDocOpCount(docId).catch(() => 0);
    setPendingCount(pending);
    if (pending === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await runDocSyncEngine(docId);
      if (result && result.remoteOps.length > 0) {
        const transformed = await transformRemoteOps(docId, result.remoteOps);
        if (transformed.length > 0) {
          onRemoteOpsRef.current?.(transformed);
        }
      }
      await refreshPendingCount();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [docId, refreshPendingCount]);

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

  useEffect(() => {
    const timer = setInterval(sync, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sync]);

  useEffect(() => {
    refreshPendingCount();
    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isSyncing, isOffline, pendingCount, sync };
}

export function useDocSyncStatus(docId: string) {
  const { isSyncing, isOffline, pendingCount } = useDocSyncEngine({ docId });

  type StatusLabel = "synced" | "syncing" | "offline" | "pending";

  const status: StatusLabel = (() => {
    if (isOffline) return "offline";
    if (isSyncing) return "syncing";
    if (pendingCount > 0) return "pending";
    return "synced";
  })();

  return { status, isSyncing, isOffline, pendingCount };
}

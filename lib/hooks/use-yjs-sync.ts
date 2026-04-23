"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { getLocalDB } from "@/lib/db/local";
import { uint8ToBase64, base64ToUint8 } from "@/lib/yjs/encoding";
import { useDocEventSource } from "@/lib/hooks/use-doc-event-source";

async function fetchAndApplyServerUpdates(docId: string, ydoc: Y.Doc) {
  const res = await fetch(`/api/docs/${docId}/yjs`);
  if (!res.ok) return;
  const data = (await res.json()) as { updates: string[] };
  for (const b64 of data.updates ?? []) {
    Y.applyUpdate(ydoc, base64ToUint8(b64), "remote-initial");
  }
}

const FLUSH_INTERVAL_MS = 5_000;

export type YjsSyncStatus = "synced" | "syncing" | "pending" | "offline";

export interface YjsSyncState {
  status: YjsSyncStatus;
  isSyncing: boolean;
  isOffline: boolean;
  pendingCount: number;
  /** True once the initial GET /yjs fetch has completed (success or failure). */
  initialSyncDone: boolean;
}

interface UseYjsSyncOptions {
  ydoc: Y.Doc | null;
  docId: string;
  /** Called once the initial server state has been applied to ydoc. */
  onInitialSync?: () => void;
}

/**
 * Manages the full Yjs sync lifecycle:
 *
 * 1. On mount: fetches all server updates via GET /api/docs/:docId/yjs and
 *    applies them to the local Y.Doc so it starts in sync with the server.
 *
 * 2. On every local update: writes the raw binary update to the Dexie
 *    `yUpdates` outbox (status=pending), tagged so the ydoc.on("update")
 *    listener can skip remote-applied updates.
 *
 * 3. On a periodic interval (and on reconnect): flushes all pending rows from
 *    the Dexie outbox via POST /api/docs/:docId/yjs, marks them as acked.
 *
 * 4. Via SSE: receives `yjs_update` events on the doc channel and applies
 *    them with Y.applyUpdate — Yjs's CRDT guarantees idempotency so
 *    duplicate applies are safe.
 */
export function useYjsSync({
  ydoc,
  docId,
  onInitialSync,
}: UseYjsSyncOptions): YjsSyncState {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  const flushingRef = useRef(false);
  const onInitialSyncRef = useRef(onInitialSync);
  onInitialSyncRef.current = onInitialSync;

  // Holds the latest flush function so commitPending can trigger it immediately
  // without creating a circular effect dependency.
  const flushRef = useRef<() => Promise<void>>(async () => {});

  // Pending update accumulator: collect deltas between debounce flushes
  const pendingUpdatesRef = useRef<Uint8Array[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Step 1: initial server sync ─────────────────────────────────────────────
  useEffect(() => {
    if (!ydoc) return;

    async function fetchInitial() {
      try {
        await fetchAndApplyServerUpdates(docId, ydoc!);
        onInitialSyncRef.current?.();
      } catch (err) {
        console.error("[use-yjs-sync] initial fetch failed", err);
      } finally {
        setInitialSyncDone(true);
      }
    }

    void fetchInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, ydoc]);

  // ── Step 2: capture local updates into Dexie outbox (debounced 500 ms) ──────
  useEffect(() => {
    if (!ydoc) return;

    const commitPending = () => {
      const accumulated = pendingUpdatesRef.current;
      if (accumulated.length === 0) return;
      pendingUpdatesRef.current = [];

      // Merge all accumulated deltas into one compact update so a rapid burst
      // of keystrokes produces a single IndexedDB row instead of hundreds.
      const merged = accumulated.length === 1
        ? accumulated[0]
        : Y.mergeUpdates(accumulated);

      const db = getLocalDB();
      void db.yUpdates.add({
        docId,
        update: merged,
        status: "pending",
        createdAt: new Date().toISOString(),
      }).then(() => {
        setPendingCount((c) => c + 1);
        // Immediately push to the server instead of waiting for the 5s interval.
        void flushRef.current();
      });
    };

    const handler = (update: Uint8Array, origin: unknown) => {
      // Skip updates that came from the server — either the initial fetch or
      // a live SSE broadcast — so they are never re-queued to the outbox.
      if (origin === "remote-sse" || origin === "remote-initial") return;

      pendingUpdatesRef.current.push(update);

      // Reset the 500 ms debounce window on every incoming delta
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(commitPending, 500);
    };

    ydoc.on("update", handler);
    return () => {
      ydoc.off("update", handler);
      // Flush any remaining buffered updates on cleanup
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      commitPending();
    };
  }, [docId, ydoc]);

  // ── Step 3: flush outbox to server ──────────────────────────────────────────
  // Keep flushRef in sync so commitPending can call the latest flush without
  // adding it as a dependency of the update-capture effect.
  const flush = useCallback(async () => {
    if (!ydoc || flushingRef.current || !navigator.onLine) return;

    const db = getLocalDB();
    const pending = await db.yUpdates
      .where({ docId, status: "pending" })
      .toArray();

    if (pending.length === 0) return;

    flushingRef.current = true;
    setIsSyncing(true);

    for (const row of pending) {
      try {
        const res = await fetch(`/api/docs/${docId}/yjs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ update: uint8ToBase64(row.update) }),
        });

        if (res.ok) {
          // Delete immediately — y-indexeddb holds the durable CRDT state,
          // so acked rows have no further purpose and would accumulate forever.
          await db.yUpdates.delete(row.id!);
          setPendingCount((c) => Math.max(0, c - 1));
        } else {
          await db.yUpdates.update(row.id!, { status: "pending" });
        }
      } catch {
        // leave as pending to retry on next interval
      }
    }

    flushingRef.current = false;
    setIsSyncing(false);
  }, [docId, ydoc]);

  // Keep the ref in sync so commitPending always calls the latest flush closure.
  flushRef.current = flush;

  // Periodic flush (belt-and-suspenders: catches any updates that slipped
  // through, e.g. from the cleanup path of the update-capture effect).
  useEffect(() => {
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [flush]);

  // Flush on visibility change — drain the outbox immediately when the tab hides
  // so edits aren't lost if the user closes the tab before the next interval.
  useEffect(() => {
    function handleVisibility() {
      void flush();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [flush]);

  // ── Step 4: online/offline transitions ──────────────────────────────────────
  useEffect(() => {
    async function handleOnline() {
      setIsOffline(false);
      // Flush local pending updates and pull missed server updates in parallel.
      // Yjs CRDT guarantees idempotency, so re-applying already-seen updates is safe.
      await Promise.all([
        flush(),
        ydoc ? fetchAndApplyServerUpdates(docId, ydoc) : Promise.resolve(),
      ]);
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
  }, [docId, flush, ydoc]);

  // ── Step 5: SSE listener for remote Yjs updates ─────────────────────────────
  // Shares a single EventSource connection with useDocPresence via the
  // ref-counted pool in useDocEventSource.
  useDocEventSource(docId, "yjs_update", (e: MessageEvent<string>) => {
    if (!ydoc) return;
    try {
      // SSE data shape: { type, payload: { update }, docId }
      const data = JSON.parse(e.data) as { payload?: { update?: string } };
      if (data.payload?.update) {
        // Apply with a recognisable origin so the ydoc.on("update") handler
        // above can skip writing remote updates back to the outbox.
        Y.applyUpdate(ydoc, base64ToUint8(data.payload.update), "remote-sse");
      }
    } catch (err) {
      console.error("[use-yjs-sync] SSE apply failed", err);
    }
  });

  // ── Derive status label ──────────────────────────────────────────────────────
  const status: YjsSyncStatus = (() => {
    if (isOffline) return "offline";
    if (isSyncing) return "syncing";
    if (pendingCount > 0) return "pending";
    return "synced";
  })();

  return { status, isSyncing, isOffline, pendingCount, initialSyncDone };
}

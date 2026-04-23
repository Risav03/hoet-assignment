"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { getLocalDB } from "@/lib/db/local";
import { uint8ToBase64, base64ToUint8 } from "@/lib/yjs/encoding";

const FLUSH_INTERVAL_MS = 5_000;
const LOCAL_ORIGIN = "local-client";

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
  /**
   * Return the current editor content as a plain JSON object.
   * When provided, the hook periodically sends this to the server so a new
   * DocumentSnapshot + incremented currentRev are created for the history panel.
   */
  getSnapshot?: () => unknown;
  /** Called whenever the server confirms a new DocumentSnapshot was created. */
  onSnapshotSaved?: () => void;
}

/** How many successful flushes between history snapshot writes (~50 s at 5 s interval). */
const SNAPSHOT_EVERY_N_FLUSHES = 10;

/**
 * Manages the full Yjs sync lifecycle:
 *
 * 1. On mount: fetches all server updates via GET /api/docs/:docId/yjs and
 *    applies them to the local Y.Doc so it starts in sync with the server.
 *
 * 2. On every local update: writes the raw binary update to the Dexie
 *    `yUpdates` outbox (status=pending), tagged with `LOCAL_ORIGIN` so the
 *    ydoc.on("update") listener can skip remote-applied updates.
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
  getSnapshot,
  onSnapshotSaved,
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
  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;
  const onSnapshotSavedRef = useRef(onSnapshotSaved);
  onSnapshotSavedRef.current = onSnapshotSaved;

  // Pending update accumulator: collect deltas between debounce flushes
  const pendingUpdatesRef = useRef<Uint8Array[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Count successful flushes so we know when to attach a history snapshot
  const flushCountRef = useRef(0);

  // ── Step 1: initial server sync ─────────────────────────────────────────────
  useEffect(() => {
    if (!ydoc) return;

    async function fetchInitial() {
      try {
        const res = await fetch(`/api/docs/${docId}/yjs`);
        if (!res.ok) return;
        const data = await res.json() as { updates: string[] };
        if (data.updates?.length) {
          for (const b64 of data.updates) {
            // Tag with "remote-initial" so the ydoc.on("update") handler
            // skips writing these back to the Dexie outbox.
            Y.applyUpdate(ydoc!, base64ToUint8(b64), "remote-initial");
          }
        }
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

  // ── Step 2: capture local updates into Dexie outbox (debounced 2 s) ─────────
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
      });
    };

    const handler = (update: Uint8Array, origin: unknown) => {
      // Skip updates that came from the server — either the initial fetch or
      // a live SSE broadcast — so they are never re-queued to the outbox.
      if (origin === "remote-sse" || origin === "remote-initial") return;

      pendingUpdatesRef.current.push(update);

      // Reset the 2-second debounce window on every incoming delta
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
  const flush = useCallback(async (forceSnapshot = false) => {
    if (!ydoc || flushingRef.current || !navigator.onLine) return;

    const db = getLocalDB();
    const pending = await db.yUpdates
      .where({ docId, status: "pending" })
      .toArray();

    if (pending.length === 0) return;

    flushingRef.current = true;
    setIsSyncing(true);

    // Attach a history snapshot every N successful flushes of genuine user edits,
    // or when forced (e.g. tab hidden).  The first-flush special case has been
    // removed: it was triggering a snapshot — and a currentRev increment — on
    // every page open, even when the outbox only contained re-sent server data.
    flushCountRef.current += 1;
    const attachSnapshot =
      forceSnapshot ||
      flushCountRef.current % SNAPSHOT_EVERY_N_FLUSHES === 0;
    const snapshotContent = attachSnapshot ? getSnapshotRef.current?.() : undefined;

    for (let i = 0; i < pending.length; i++) {
      const row = pending[i];
      // Only attach the snapshot JSON to the very last update in the batch so
      // we don't create duplicate history entries for a single flush.
      const isLast = i === pending.length - 1;
      try {
        const b64 = uint8ToBase64(row.update);
        const body: Record<string, unknown> = { update: b64 };
        if (isLast && snapshotContent !== undefined) {
          body.content = snapshotContent;
        }

        const res = await fetch(`/api/docs/${docId}/yjs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          await db.yUpdates.update(row.id!, { status: "acked" });
          setPendingCount((c) => Math.max(0, c - 1));
          const json = await res.json().catch(() => ({})) as { snapshotCreated?: boolean };
          if (json.snapshotCreated) onSnapshotSavedRef.current?.();
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

  // Periodic flush
  useEffect(() => {
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [flush]);

  // Flush on visibility change — force a history snapshot when hiding so the
  // last edit is always captured even if the flush counter hasn't reached N yet.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        void flush(true); // force snapshot
      } else {
        void flush();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [flush]);

  // ── Step 4: online/offline transitions ──────────────────────────────────────
  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      void flush();
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
  }, [flush]);

  // ── Step 5: SSE listener for remote Yjs updates ─────────────────────────────
  useEffect(() => {
    if (!ydoc || typeof EventSource === "undefined") return;

    const es = new EventSource(`/api/events?docId=${encodeURIComponent(docId)}`);

    const handler = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as { update?: string };
        if (data.update) {
          // Apply with a recognisable origin so the ydoc.on("update") handler
          // above can skip writing remote updates back to the outbox.
          Y.applyUpdate(ydoc!, base64ToUint8(data.update), "remote-sse");
        }
      } catch (err) {
        console.error("[use-yjs-sync] SSE apply failed", err);
      }
    };

    es.addEventListener("yjs_update", handler);

    return () => {
      es.removeEventListener("yjs_update", handler);
      es.close();
    };
  }, [docId, ydoc]);

  // ── Derive status label ──────────────────────────────────────────────────────
  const status: YjsSyncStatus = (() => {
    if (isOffline) return "offline";
    if (isSyncing) return "syncing";
    if (pendingCount > 0) return "pending";
    return "synced";
  })();

  void LOCAL_ORIGIN; // referenced in comment; suppress unused warning

  return { status, isSyncing, isOffline, pendingCount, initialSyncDone };
}

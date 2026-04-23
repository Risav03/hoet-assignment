import { redis } from "@/lib/redis";
import { workspaceStateKey } from "@/lib/sse/redis-emitter";

const FLUSH_DELAY_MS = 10_000;

type FlushTimer = ReturnType<typeof setTimeout>;

const globalForFlush = global as unknown as {
  __pendingWorkspaceFlush: Map<string, FlushTimer> | undefined;
};

const pendingFlush: Map<string, FlushTimer> =
  globalForFlush.__pendingWorkspaceFlush ?? new Map();

if (process.env.NODE_ENV !== "production") {
  globalForFlush.__pendingWorkspaceFlush = pendingFlush;
}

/**
 * Debounce writes of the ephemeral Redis state into the authoritative DB.
 *
 * Behavior:
 *   - First call schedules a flush ~10s out.
 *   - Subsequent calls within that window are no-ops (coalesced).
 *   - On fire we snapshot Redis, clear the pending entry, and persist.
 *
 * This is a best-effort soft-write — callers that need strong durability
 * should still perform their own DB mutation inline.
 */
export function scheduleFlush(workspaceId: string): void {
  if (pendingFlush.has(workspaceId)) return;

  const timeout = setTimeout(async () => {
    pendingFlush.delete(workspaceId);

    try {
      const data = await redis.get(workspaceStateKey(workspaceId));
      if (!data) return;

      const parsed = JSON.parse(data) as Record<string, unknown>;
      await persistWorkspaceState(workspaceId, parsed);
    } catch (err) {
      console.error("[workspace-flush] flush failed", workspaceId, err);
    }
  }, FLUSH_DELAY_MS);

  // Prevent a pending timer from keeping a serverless function alive.
  if (typeof timeout === "object" && timeout !== null && "unref" in timeout) {
    (timeout as NodeJS.Timeout).unref?.();
  }

  pendingFlush.set(workspaceId, timeout);
}

/**
 * Force-flush any pending state for a workspace immediately.
 * Useful on controlled shutdowns or when a caller needs durability now.
 */
export async function flushNow(workspaceId: string): Promise<void> {
  const timer = pendingFlush.get(workspaceId);
  if (timer) {
    clearTimeout(timer);
    pendingFlush.delete(workspaceId);
  }

  const data = await redis.get(workspaceStateKey(workspaceId));
  if (!data) return;

  const parsed = JSON.parse(data) as Record<string, unknown>;
  await persistWorkspaceState(workspaceId, parsed);
}

/**
 * Hook for actually persisting the snapshot. Kept intentionally minimal:
 * the authoritative writes already happen inline in the DAL layer (e.g.
 * `applyBoardOp`), so this is the place to add aggregated work such as
 * bumping `workspace.lastActivityAt`, compacting presence, etc.
 */
async function persistWorkspaceState(
  _workspaceId: string,
  _snapshot: Record<string, unknown>
): Promise<void> {
  // TODO: wire up aggregated DB writes (e.g. workspace.lastActivityAt,
  //   compacted presence snapshots, activity-log batching). The canonical
  //   per-op writes continue to happen inline in lib/dal/*.
}

import { pub, redis } from "@/lib/redis";

export interface SSEEvent {
  type: string;
  payload: Record<string, unknown>;
}

export function workspaceChannel(workspaceId: string) {
  return `workspace:${workspaceId}`;
}

export function workspaceStateKey(workspaceId: string) {
  return `workspace:${workspaceId}:state`;
}

/**
 * Publish an SSE event to every connected subscriber of a workspace channel.
 *
 * Safe to `await` — failures are logged but never thrown so a broken Redis
 * connection cannot block the originating HTTP request.
 */
export async function emitSSEEvent(workspaceId: string, event: SSEEvent): Promise<void> {
  try {
    await pub.publish(workspaceChannel(workspaceId), JSON.stringify(event));
  } catch (err) {
    console.error("[redis-emitter] publish failed", err);
  }
}

/**
 * Shallow-merge a patch into the ephemeral workspace state stored in Redis.
 * Returns the merged object so callers can avoid re-reading.
 */
export async function updateWorkspaceState(
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const key = workspaceStateKey(workspaceId);

  const current = await redis.get(key);
  const parsed = current ? (JSON.parse(current) as Record<string, unknown>) : {};
  const updated = { ...parsed, ...patch };

  await redis.set(key, JSON.stringify(updated));
  return updated;
}

export async function getWorkspaceState(
  workspaceId: string
): Promise<Record<string, unknown> | null> {
  const data = await redis.get(workspaceStateKey(workspaceId));
  return data ? (JSON.parse(data) as Record<string, unknown>) : null;
}

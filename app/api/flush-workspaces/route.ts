import { redis } from "@/lib/redis";
import { workspaceStateKey } from "@/lib/sse/redis-emitter";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceIds = await redis.smembers("dirty:workspaces");

    for (const workspaceId of workspaceIds) {
      const data = await redis.get(workspaceStateKey(workspaceId));
      if (!data) {
        await redis.srem("dirty:workspaces", workspaceId);
        continue;
      }

      try {
        await db.workspace.update({
          where: { id: workspaceId },
          data: { updatedAt: new Date() },
        });
        await redis.srem("dirty:workspaces", workspaceId);
      } catch (err) {
        // Keep in dirty set — will retry on next cron run
        console.error("[flush-workspaces] DB write failed", workspaceId, err);
      }
    }

    return Response.json({ success: true, flushed: workspaceIds.length });
  } catch (err) {
    console.error("[flush-workspaces] flush error", err);
    return Response.json({ error: "Flush failed" }, { status: 500 });
  }
}

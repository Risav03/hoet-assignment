import { redis } from "@/lib/redis";
import { workspaceStateKey } from "@/lib/sse/redis-emitter";
import { boardStateKey, type RedisBoardState } from "@/lib/sync/board-redis";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [workspaceIds, boardIds] = await Promise.all([
      redis.smembers("dirty:workspaces"),
      redis.smembers("dirty:boards"),
    ]);

    // ── Flush dirty boards (nodes + edges) ──────────────────────────────────
    for (const boardId of boardIds) {
      const data = await redis.get(boardStateKey(boardId));
      if (!data) {
        await redis.srem("dirty:boards", boardId);
        continue;
      }

      const state = JSON.parse(data) as RedisBoardState;
      const nodeIds = Object.keys(state.nodes);
      const edgeIds = Object.keys(state.edges);

      try {
        await db.$transaction(async (tx: Prisma.TransactionClient) => {
          // Upsert all nodes present in Redis state
          for (const node of Object.values(state.nodes)) {
            await tx.boardNode.upsert({
              where: { id: node.id },
              create: {
                id: node.id,
                boardId,
                type: node.type,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
                content: node.content as Prisma.InputJsonValue,
                createdAt: new Date(node.createdAt),
                updatedAt: new Date(node.updatedAt),
                lastModifiedById: node.lastModifiedById ?? null,
                lastModifiedByName: node.lastModifiedByName ?? null,
              },
              update: {
                type: node.type,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
                content: node.content as Prisma.InputJsonValue,
                updatedAt: new Date(node.updatedAt),
                lastModifiedById: node.lastModifiedById ?? null,
                lastModifiedByName: node.lastModifiedByName ?? null,
              },
            });
          }

          // Remove nodes deleted from Redis state
          await tx.boardNode.deleteMany({
            where: {
              boardId,
              ...(nodeIds.length > 0 ? { id: { notIn: nodeIds } } : {}),
            },
          });

          // Upsert all edges present in Redis state
          for (const edge of Object.values(state.edges)) {
            await tx.boardEdge.upsert({
              where: {
                boardId_sourceId_targetId: {
                  boardId,
                  sourceId: edge.sourceId,
                  targetId: edge.targetId,
                },
              },
              create: {
                id: edge.id,
                boardId,
                sourceId: edge.sourceId,
                targetId: edge.targetId,
                label: edge.label ?? null,
              },
              update: {
                label: edge.label ?? null,
              },
            });
          }

          // Remove edges deleted from Redis state
          await tx.boardEdge.deleteMany({
            where: {
              boardId,
              ...(edgeIds.length > 0 ? { id: { notIn: edgeIds } } : {}),
            },
          });
        });

        await redis.srem("dirty:boards", boardId);
      } catch (err) {
        // Keep in dirty set — retry on next cron run
        console.error("[flush-workspaces] board sync failed", boardId, err);
      }
    }

    // ── Flush dirty workspaces (workspace-level metadata) ───────────────────
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
        // Keep in dirty set — retry on next cron run
        console.error("[flush-workspaces] workspace sync failed", workspaceId, err);
      }
    }

    return Response.json({
      success: true,
      flushed: { boards: boardIds.length, workspaces: workspaceIds.length },
    });
  } catch (err) {
    console.error("[flush-workspaces] flush error", err);
    return Response.json({ error: "Flush failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBoardVersionById, createBoardVersion } from "@/lib/dal/board";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
import { db } from "@/lib/db";
import { emitSSEEvent } from "@/lib/sse/redis-emitter";
import type { CanvasNode, CanvasEdge } from "@/lib/types/canvas";
import type { Prisma } from "@/app/generated/prisma/client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId, versionId } = await params;
  const userId = session.user.id;
  const userName = session.user.name ?? "Unknown";

  try {
    // Load the board and check membership in a single query
    const board = await db.board.findUnique({ where: { id: boardId } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    await requireWorkspaceMember(board.workspaceId, userId, ["OWNER", "EDITOR"]);

    const targetVersion = await getBoardVersionById(versionId, boardId, userId);
    if (!targetVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const versionNodes = targetVersion.nodes;
    const versionEdges = targetVersion.edges;
    const now = new Date();

    // Single atomic transaction: wipe the current state and replay the version.
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete all edges first (FK constraints), then all nodes
      await tx.boardEdge.deleteMany({ where: { boardId } });
      await tx.boardNode.deleteMany({ where: { boardId } });

      // Recreate nodes from the version
      const nodeValues = Object.values(versionNodes) as CanvasNode[];
      for (const node of nodeValues) {
        await tx.boardNode.create({
          data: {
            id: node.id,
            boardId,
            type: node.type,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            content: node.content as Prisma.InputJsonValue,
            updatedAt: now,
            lastModifiedById: userId,
            lastModifiedByName: userName,
          },
        });
      }

      // Recreate edges from the version
      const edgeValues = Object.values(versionEdges) as CanvasEdge[];
      for (const edge of edgeValues) {
        // Only create edges whose source and target nodes exist in the version
        if (versionNodes[edge.sourceId] && versionNodes[edge.targetId]) {
          await tx.boardEdge.create({
            data: {
              id: edge.id,
              boardId,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              label: edge.label ?? null,
            },
          });
        }
      }
    });

    // Emit a single SSE event so every connected client reinitialises its canvas
    await emitSSEEvent(board.workspaceId, {
      type: "canvas_board_restored",
      payload: {
        boardId,
        nodes: versionNodes,
        edges: versionEdges,
        restoredById: userId,
        restoredByName: userName,
      },
    });

    // Record the restore as a new version entry in the history
    try {
      const restoredLabel = targetVersion.label
        ? `Restored: ${targetVersion.label}`
        : `Restored version from ${new Date(targetVersion.createdAt).toLocaleString()}`;

      await createBoardVersion(
        boardId,
        userId,
        userName,
        versionNodes,
        versionEdges,
        restoredLabel
      );
    } catch (snapshotErr) {
      console.error("[restore] post-restore snapshot failed", snapshotErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("not found")) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[board version restore]", err);
    return NextResponse.json({ error: "Failed to restore version" }, { status: 500 });
  }
}

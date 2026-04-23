"use client";
import { useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  runCanvasSyncEngine,
  markOpCommitted,
  markOpRejected,
} from "@/lib/sync/canvas-engine";
import { useNetworkStatus } from "./use-network-status";
import type { SSEMessage } from "./use-sse";
import type { CanvasOp, ConflictInfo, NodeMover } from "@/lib/types/canvas";

const BASE_INTERVAL = 1_000;
const RETRY_INTERVAL = 3_000;
const MOVER_DISPLAY_MS = 3_000;

export function useCanvasSyncEngine(boardId: string | null) {
  const { data: session } = useSession();
  const isOnline = useNetworkStatus();
  const retryCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(async () => {
    if (!boardId || !session?.user?.id || !isOnline) return;
    try {
      await runCanvasSyncEngine(boardId);
      retryCountRef.current = 0;
    } catch {
      retryCountRef.current = 1;
    }
  }, [boardId, session?.user?.id, isOnline]);

  useEffect(() => {
    if (!isOnline || !boardId) return;

    sync();

    function schedule() {
      const delay = retryCountRef.current > 0 ? RETRY_INTERVAL : BASE_INTERVAL;
      timerRef.current = setTimeout(async () => {
        await sync();
        schedule();
      }, delay);
    }

    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOnline, boardId, sync]);
}

export function useCanvasSSEHandler(boardId: string | null) {
  const { data: session } = useSession();
  const store = useCanvasStore();

  const handleSSEMessage = useCallback(
    async (msg: SSEMessage) => {
      if (!boardId) return;

      if (msg.type === "canvas_op_applied") {
        const msgBoardId = msg.payload.boardId as string | undefined;
        if (msgBoardId !== boardId) return;

        const operationId = msg.payload.operationId as string;
        const authorId = msg.payload.authorId as string;
        const authorName = msg.payload.authorName as string;
        const authorColor = msg.payload.authorColor as string;
        const op = msg.payload.op as CanvasOp;

        if (authorId === session?.user?.id) {
          // Our own op was confirmed by the server — mark it committed
          await markOpCommitted(operationId);
          store.applyCommitted(operationId);
        } else {
          // Remote op from another user — apply it to our canvas
          store.applyOp(op);

          // Show the mover label on any node involved in this op
          const nodeId =
            op.type === "MOVE_NODE" || op.type === "UPDATE_NODE" || op.type === "DELETE_NODE"
              ? op.payload.id
              : op.type === "CREATE_NODE"
              ? op.payload.id
              : null;

          if (nodeId) {
            const mover: NodeMover = {
              userId: authorId,
              name: authorName,
              color: authorColor,
              expiresAt: Date.now() + MOVER_DISPLAY_MS,
            };
            store.setNodeMover(nodeId, mover);
          }
        }
      }

      if (msg.type === "canvas_conflict_resolved") {
        const msgBoardId = msg.payload.boardId as string | undefined;
        if (msgBoardId !== boardId) return;

        const operationId = msg.payload.operationId as string;
        const conflict = msg.payload.conflict as ConflictInfo | undefined;

        if (conflict?.loserUserId === session?.user?.id) {
          // Our op was rejected — roll back the optimistic update
          await markOpRejected(operationId);
          store.rollbackOp(operationId);
        }
      }
    },
    [boardId, session?.user?.id, store]
  );

  return { handleSSEMessage };
}

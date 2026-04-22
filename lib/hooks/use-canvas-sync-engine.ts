"use client";
import { useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  runCanvasSyncEngine,
  markOpCommitted,
  markOpRejected,
  getOpByProposalId,
} from "@/lib/sync/canvas-engine";
import { useNetworkStatus } from "./use-network-status";
import type { SSEMessage } from "./use-sse";

const BASE_INTERVAL = 10_000;
const RETRY_BACKOFF = [3_000, 6_000, 12_000, 24_000, 60_000];

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
      retryCountRef.current = Math.min(retryCountRef.current + 1, RETRY_BACKOFF.length - 1);
    }
  }, [boardId, session?.user?.id, isOnline]);

  useEffect(() => {
    if (!isOnline || !boardId) return;

    sync();

    function schedule() {
      const delay =
        retryCountRef.current > 0
          ? RETRY_BACKOFF[retryCountRef.current - 1]
          : BASE_INTERVAL;
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
  const store = useCanvasStore();

  const handleSSEMessage = useCallback(
    async (msg: SSEMessage) => {
      if (!boardId) return;

      if (msg.type === "proposal_committed") {
        const proposalId = msg.payload.proposalId as string | undefined;
        const msgBoardId = msg.payload.boardId as string | undefined;

        if (msgBoardId !== boardId || !proposalId) return;

        // Find the local op associated with this proposal
        const localOp = await getOpByProposalId(proposalId);
        if (localOp) {
          await markOpCommitted(localOp.operationId);
          store.applyCommitted(localOp.operationId);
        }
      }

      if (msg.type === "proposal_rejected") {
        const proposalId = msg.payload.proposalId as string | undefined;
        const msgBoardId = msg.payload.boardId as string | undefined;

        if (msgBoardId !== boardId || !proposalId) return;

        const localOp = await getOpByProposalId(proposalId);
        if (localOp) {
          await markOpRejected(localOp.operationId);
          store.rollbackOp(localOp.operationId);
        }
      }
    },
    [boardId, store]
  );

  return { handleSSEMessage };
}

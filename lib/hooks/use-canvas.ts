"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  enqueueCanvasOp,
  dispatchCanvasOp,
  createOperationId,
} from "@/lib/sync/canvas-engine";
import type { CanvasOp, BoardMeta, BoardState } from "@/lib/types/canvas";

interface BoardWithState extends BoardMeta {
  state: BoardState;
}

async function fetchBoard(boardId: string): Promise<BoardWithState> {
  const res = await fetch(`/api/boards/${boardId}`);
  if (!res.ok) throw new Error("Failed to fetch board");
  return res.json() as Promise<BoardWithState>;
}

async function fetchBoards(workspaceId: string): Promise<{ boards: BoardMeta[] }> {
  const res = await fetch(`/api/boards?workspaceId=${workspaceId}`);
  if (!res.ok) throw new Error("Failed to fetch boards");
  return res.json() as Promise<{ boards: BoardMeta[] }>;
}

async function createBoardReq(workspaceId: string, title: string): Promise<BoardMeta> {
  const res = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, title }),
  });
  if (!res.ok) throw new Error("Failed to create board");
  return res.json() as Promise<BoardMeta>;
}

export function useBoards(workspaceId: string | null) {
  return useQuery({
    queryKey: ["boards", workspaceId],
    queryFn: () => fetchBoards(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useBoardData(boardId: string | null) {
  const initBoard = useCanvasStore((s) => s.initBoard);

  return useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const data = await fetchBoard(boardId!);
      const hasPending = useCanvasStore.getState().pendingOps.length > 0;
      if (!hasPending) {
        initBoard(data.id, data.state);
      }
      return data;
    },
    enabled: !!boardId,
    staleTime: 0,
    refetchInterval: 1_000,
  });
}

export function useCreateBoard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => createBoardReq(workspaceId, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boards", workspaceId] });
    },
  });
}

export function useCanvasDispatch(boardId: string, workspaceId: string) {
  const { data: session } = useSession();
  const store = useCanvasStore();

  return async function dispatch(op: CanvasOp) {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    // Generate a stable operation ID
    const operationId = createOperationId();

    // Apply locally immediately
    store.applyOp(op);

    // Create the pending op record
    const localOp = dispatchCanvasOp(boardId, workspaceId, userId, op);
    const pendingOp = {
      ...localOp,
      operationId,
    };

    store.enqueuePendingOp({
      operationId,
      boardId,
      workspaceId,
      op,
      createdAt: pendingOp.createdAt,
      status: "pending",
    });

    // Save to IndexedDB for offline support
    await enqueueCanvasOp({ ...pendingOp });
  };
}

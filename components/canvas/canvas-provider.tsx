"use client";
import { useEffect } from "react";
import { useBoardData } from "@/lib/hooks/use-canvas";
import { useCanvasSyncEngine, useCanvasSSEHandler } from "@/lib/hooks/use-canvas-sync-engine";
import { useCanvasPresence } from "@/lib/hooks/use-canvas-presence";
import { useSSE } from "@/lib/hooks/use-sse";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { CanvasBoard } from "./canvas-board";
import type { SSEMessage } from "@/lib/hooks/use-sse";
import type { PresenceData } from "@/lib/types/canvas";

interface CanvasProviderProps {
  boardId: string;
  workspaceId: string;
}

export function CanvasProvider({ boardId, workspaceId }: CanvasProviderProps) {
  const { data: board, isLoading, error } = useBoardData(boardId);
  const reset = useCanvasStore((s) => s.reset);

  // Start canvas sync engine
  useCanvasSyncEngine(boardId);

  // Get SSE handler for canvas events
  const { handleSSEMessage } = useCanvasSSEHandler(boardId);
  const { handleRemotePresence } = useCanvasPresence(boardId);

  const updatePresence = useCanvasStore((s) => s.updatePresence);

  const onSSEMessage = (msg: SSEMessage) => {
    if (msg.type === "canvas_presence") {
      const payload = msg.payload as {
        boardId?: string;
        userId: string;
        name: string;
        x: number;
        y: number;
        color: string;
        updatedAt: number;
      };
      if (payload.boardId === boardId) {
        const presenceData: PresenceData = {
          userId: payload.userId,
          name: payload.name,
          x: payload.x,
          y: payload.y,
          color: payload.color,
          updatedAt: payload.updatedAt,
        };
        handleRemotePresence(presenceData);
        updatePresence(presenceData);
      }
      return;
    }
    handleSSEMessage(msg);
  };

  useSSE({
    workspaceId,
    onMessage: onSSEMessage,
    enabled: true,
  });

  // Reset store on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset, boardId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading canvas…</p>
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground mb-1">Failed to load canvas</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Something went wrong"}
          </p>
        </div>
      </div>
    );
  }

  return <CanvasBoard boardId={boardId} workspaceId={workspaceId} />;
}

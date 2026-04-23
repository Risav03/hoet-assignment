"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Plus } from "lucide-react";
import { CanvasProvider } from "@/components/canvas/canvas-provider";
import { useCreateBoard } from "@/lib/hooks/use-canvas";
import type { BoardMeta } from "@/lib/types/canvas";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface CanvasPageClientProps {
  workspace: Workspace;
  boards: BoardMeta[];
  activeBoardId: string | null;
  userId: string;
}

export function CanvasPageClient({
  workspace,
  boards,
  activeBoardId,
  userId: _userId,
}: CanvasPageClientProps) {
  const router = useRouter();
  const [localBoards, setLocalBoards] = useState<BoardMeta[]>(boards);
  const [activeId, setActiveId] = useState<string | null>(activeBoardId);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const createBoard = useCreateBoard(workspace.id);

  function handleSelectBoard(id: string) {
    setActiveId(id);
    router.push(`/workspaces/${workspace.slug}/canvas?boardId=${id}`);
  }

  async function handleCreateBoard() {
    const title = newTitle.trim() || "New Board";
    try {
      const board = await createBoard.mutateAsync(title);
      const newBoard: BoardMeta = {
        id: board.id,
        workspaceId: board.workspaceId,
        title: board.title,
        isArchived: board.isArchived,
        createdAt: String(board.createdAt),
        updatedAt: String(board.updatedAt),
      };
      setLocalBoards((prev) => [newBoard, ...prev]);
      setActiveId(newBoard.id);
      setIsCreating(false);
      setNewTitle("");
      router.push(`/workspaces/${workspace.slug}/canvas?boardId=${newBoard.id}`);
    } catch {
      // error handled by mutation
    }
  }

  // keep handleSelectBoard and localBoards used for potential future board sidebar
  void handleSelectBoard;
  void localBoards;

  const activeBoard = localBoards.find((b) => b.id === activeId);

  return (
    <div className="flex h-full">
      {/* Canvas area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header bar */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border shrink-0 bg-background">
          <LayoutGrid className="w-4 h-4 text-muted-foreground shrink-0" />
          <h1 className="text-sm font-semibold text-foreground truncate">
            {activeBoard?.title ?? "Canvas"}
          </h1>
          <span className="text-xs text-muted-foreground">— {workspace.name}</span>
        </div>

        {/* Main canvas or empty state */}
        {activeId ? (
          <CanvasProvider boardId={activeId} workspaceId={workspace.id} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <LayoutGrid className="w-10 h-10 text-muted" />
            <div className="text-center">
              <h2 className="text-sm font-semibold text-foreground mb-1">No board selected</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Create a board to start collaborating on the canvas.
              </p>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Board
              </button>
            </div>
          </div>
        )}
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background border border-border rounded-xl shadow-xl p-5 w-80">
            <h3 className="text-sm font-semibold mb-3">New Board</h3>
            <input
              autoFocus
              type="text"
              placeholder="Board name…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBoard();
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewTitle("");
                }
              }}
              className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring mb-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateBoard}
                disabled={createBoard.isPending}
                className="flex-1 text-[11px] font-medium bg-primary text-primary-foreground rounded px-2 py-1.5 disabled:opacity-50"
              >
                {createBoard.isPending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setIsCreating(false); setNewTitle(""); }}
                className="flex-1 text-[11px] font-medium bg-accent text-accent-foreground rounded px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

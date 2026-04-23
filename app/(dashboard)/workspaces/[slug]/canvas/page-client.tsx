"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Plus, GitPullRequest } from "lucide-react";
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
  const [showProposals, setShowProposals] = useState(false);

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

  const activeBoard = localBoards.find((b) => b.id === activeId);

  return (
    <div className="flex h-full">
      {/* Board sidebar */}
      {/* <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-sidebar h-full">
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
          <LayoutGrid className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Boards</span>
          <button
            type="button"
            title="New board"
            className="ml-auto flex items-center justify-center w-6 h-6 rounded-md hover:bg-accent transition-colors"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isCreating && (
          <div className="px-3 py-2 border-b border-border">
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
              className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={handleCreateBoard}
                disabled={createBoard.isPending}
                className="flex-1 text-[11px] font-medium bg-primary text-primary-foreground rounded px-2 py-1 disabled:opacity-50"
              >
                {createBoard.isPending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setIsCreating(false); setNewTitle(""); }}
                className="flex-1 text-[11px] font-medium bg-accent text-accent-foreground rounded px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-1.5">
          {localBoards.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No boards yet.</p>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="mt-2 text-xs text-primary font-medium hover:underline"
              >
                Create one
              </button>
            </div>
          ) : (
            localBoards.map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => handleSelectBoard(board.id)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors rounded-lg mx-1 ${
                  board.id === activeId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{board.title}</span>
              </button>
            ))
          )}
        </nav>

        {activeId && (
          <div className="border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setShowProposals((v) => !v)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              Proposals
            </button>
          </div>
        )}
      </aside> */}

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

      {/* Proposals panel (side sheet) */}
      {showProposals && activeId && (
        <ProposalsPanel
          boardId={activeId}
          workspaceId={workspace.id}
          onClose={() => setShowProposals(false)}
        />
      )}
    </div>
  );
}

function ProposalsPanel({
  boardId,
  workspaceId: _workspaceId,
  onClose,
}: {
  boardId: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const [proposals, setProposals] = useState<
    { id: string; operationType: string; status: string; authorId: string; createdAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetch(`/api/boards/${boardId}/proposals`)
      .then((r) => r.json())
      .then((d) => {
        setProposals(d.proposals ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  });

  async function vote(proposalId: string, decision: "APPROVE" | "REJECT") {
    await fetch(`/api/proposals/${proposalId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? { ...p, status: decision === "APPROVE" ? "ACCEPTED" : "REJECTED" }
          : p
      )
    );
  }

  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-border bg-background h-full">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
        <GitPullRequest className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Proposals</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground">No proposals yet.</p>
          </div>
        ) : (
          proposals.map((p) => (
            <div
              key={p.id}
              className="border border-border rounded-lg p-3 text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium text-foreground">{p.operationType}</span>
                <StatusBadge status={p.status} />
              </div>
              <p className="text-muted-foreground">
                {new Date(p.createdAt).toLocaleString()}
              </p>
              {p.status === "PENDING" && (
                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => vote(p.id, "APPROVE")}
                    className="flex-1 text-[11px] font-medium bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => vote(p.id, "REJECT")}
                    className="flex-1 text-[11px] font-medium bg-red-100 text-red-700 rounded px-2 py-1 hover:bg-red-200 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    COMMITTED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    ACCEPTED: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

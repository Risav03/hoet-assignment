"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, Plus, Clock } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface DocItem {
  id: string;
  title: string;
  currentRev: number;
  updatedAt: string;
  createdAt: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface DocumentsPageClientProps {
  workspace: Workspace;
  documents: DocItem[];
  userId: string;
}

export function DocumentsPageClient({
  workspace,
  documents,
}: DocumentsPageClientProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, title }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const data = await res.json() as { document: { id: string } };
      router.push(`/workspaces/${workspace.slug}/documents/${data.document.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create document");
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">Documents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{workspace.name}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
          className="gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New document
        </Button>
      </header>

      {/* Create form */}
      {showCreate && (
        <div className="px-6 py-4 bg-muted/50 border-b border-border">
          <form onSubmit={handleCreate} className="flex items-center gap-3 max-w-md">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Document title…"
              autoFocus
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" disabled={creating || !newTitle.trim()}>
              {creating ? "Creating…" : "Create"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowCreate(false); setNewTitle(""); }}
            >
              Cancel
            </Button>
          </form>
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-6">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">No documents yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first document to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-2 max-w-3xl">
            {documents.map((doc) => (
              <Link
                key={doc.id}
                href={`/workspaces/${workspace.slug}/documents/${doc.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group"
              >
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {doc.title || "Untitled"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      v{doc.currentRev}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5" />
                      {format(new Date(doc.updatedAt), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

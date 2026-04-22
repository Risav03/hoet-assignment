"use client";
import { useState, useCallback, useEffect } from "react";
import { RichTextEditor } from "./rich-text-editor";
import { DraftAutoSave, loadDraft, clearDraft } from "./draft-auto-save";
import { VersionTimeline } from "@/components/versions/version-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, FileText, Tag, Clock } from "lucide-react";
import { createPatch } from "@/lib/sync/differ";
import { useSSE } from "@/lib/hooks/use-sse";
import { useSyncEngine } from "@/lib/hooks/use-sync-engine";
import Link from "next/link";
import { format } from "date-fns";

interface Document {
  id: string;
  title: string;
  workspaceId: string;
  contentSnapshot: string;
  currentVersionId?: string | null;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface Version {
  id: string;
  versionNumber: number;
  contentSnapshot: string;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
}

interface DocumentEditorProps {
  document: Document;
  versions: Version[];
  userRole: string;
  userId: string;
  membersCount?: number;
  workspaceSlug?: string;
}

type EditorView = "edit" | "preview" | "history";

const AI_TOOLS = [
  { label: "Summarize", action: "summarize" },
  { label: "Action items", action: "action_items" },
  { label: "Rewrite", action: "rewrite" },
  { label: "Explain", action: "explain" },
];

export function DocumentEditor({
  document,
  versions,
  userRole,
  membersCount = 1,
  workspaceSlug,
}: DocumentEditorProps) {
  const router = useRouter();
  const canEdit = userRole === "OWNER" || userRole === "EDITOR";

  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.contentSnapshot);
  const [saving, setSaving] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null);
  const [view, setView] = useState<EditorView>("edit");

  useSyncEngine();

  useSSE({
    workspaceId: document.workspaceId,
    onMessage: (msg) => {
      if (
        msg.type === "proposal_committed" &&
        (msg.payload as Record<string, unknown>).documentId === document.id
      ) {
        toast.info("A proposal was committed. Refreshing...");
        router.refresh();
      }
    },
  });

  useEffect(() => {
    loadDraft(document.id).then((draft) => {
      if (draft && draft !== document.contentSnapshot) {
        toast.info("Draft found — restored from local storage", {
          id: "draft-restored",
          action: {
            label: "Discard",
            onClick: () => {
              clearDraft(document.id);
              setContent(document.contentSnapshot);
            },
          },
        });
        setContent(draft);
      } else {
        // No draft (or draft matches) — keep the editor in sync with the
        // server snapshot. This matters after a restore/refresh where the
        // snapshot changes but local `content` state would otherwise stay stale.
        setContent(document.contentSnapshot);
      }
    });
  }, [document.id, document.contentSnapshot]);

  const handleSave = useCallback(async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
        return;
      }
      await clearDraft(document.id);
      toast.success("Document saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [canEdit, document.id, title, content, router]);

  const handlePropose = useCallback(async () => {
    if (!canEdit) return;
    setProposing(true);
    try {
      const patch = createPatch(document.contentSnapshot, content);
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: document.workspaceId,
          documentId: document.id,
          baseVersionId: document.currentVersionId,
          patch: JSON.stringify(patch),
          proposalType: "content_update",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to create proposal");
        return;
      }
      toast.success("Proposal submitted! Collaborators will be notified.");
    } finally {
      setProposing(false);
    }
  }, [canEdit, document, content]);

  const currentContent = previewVersion ? previewVersion.contentSnapshot : content;

  const VIEWS: EditorView[] = ["edit", "preview", "history"];

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      {/* Top bar — 52px */}
      <header
        className="flex items-center gap-3 px-6 shrink-0"
        style={{
          height: 52,
          background: "#ffffff",
          borderBottom: "1px solid #e4e4e7",
        }}
      >
        {/* Left: breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href={`/workspaces/${workspaceSlug ?? document.workspaceId}/documents`}>
            <button
              className="flex items-center gap-1 transition-colors"
              style={{ color: "#71717a", fontSize: 13, fontWeight: 500 }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Documents
            </button>
          </Link>
          <span style={{ color: "#d4d4d8" }}>/</span>
          <span
            className="truncate max-w-[200px]"
            style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}
          >
            {title}
          </span>
        </div>

        {/* Center: Edit / Preview / History segmented tabs */}
        <div className="flex items-center mx-auto">
          <div
            className="flex items-center p-0.5 gap-0.5"
            style={{ background: "#f4f4f5", borderRadius: 8 }}
          >
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  if (v !== "history") setPreviewVersion(null);
                }}
                className="transition-all font-semibold capitalize"
                style={{
                  padding: "4px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  background: view === v ? "#ffffff" : "transparent",
                  color: view === v ? "#18181b" : "#71717a",
                  boxShadow: view === v ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Draft + autosave + actions */}
        <div className="flex items-center gap-2 ml-auto">
          <DraftAutoSave
            documentId={document.id}
            workspaceId={document.workspaceId}
            content={content}
          />
          {previewVersion && (
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}
            >
              v{previewVersion.versionNumber}
            </span>
          )}
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}
          >
            Draft
          </span>
          {canEdit && !previewVersion && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                style={{ borderRadius: 8, fontSize: 12, fontWeight: 600 }}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              {membersCount > 1 ? (
                <Button
                  size="sm"
                  onClick={handlePropose}
                  disabled={proposing}
                  className="font-semibold text-white"
                  style={{
                    background: "#4f46e5",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 1px 2px rgba(79,70,229,.25)",
                  }}
                >
                  {proposing ? "Submitting…" : "Propose"}
                </Button>
              ) : (
                <span style={{ fontSize: 12, color: "#a1a1aa", fontStyle: "italic" }}>
                  Only collaborator
                </span>
              )}
            </>
          )}
        </div>
      </header>

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main editor */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ background: "#ffffff", padding: "40px 60px" }}
        >
          {view === "history" ? (
            previewVersion ? (
              <div style={{ maxWidth: 680 }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#18181b" }}>
                      Preview
                    </h2>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: "#fffbeb",
                        color: "#92400e",
                        border: "1px solid #fde68a",
                      }}
                    >
                      v{previewVersion.versionNumber}
                    </span>
                    <span style={{ fontSize: 12, color: "#71717a" }}>
                      by {previewVersion.createdBy.name}
                      {" · "}
                      {format(new Date(previewVersion.createdAt), "MMM d, yyyy HH:mm")}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewVersion(null)}
                  >
                    Back to history
                  </Button>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#18181b",
                    marginBottom: 24,
                  }}
                >
                  {title}
                </div>
                <RichTextEditor
                  content={previewVersion.contentSnapshot}
                  onChange={() => {}}
                  editable={false}
                  className="min-h-[400px]"
                />
              </div>
            ) : (
              <div style={{ maxWidth: 560 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#18181b", marginBottom: 16 }}>
                  Version History
                </h2>
                <VersionTimeline
                  versions={versions}
                  documentId={document.id}
                  currentVersionId={document.currentVersionId}
                  canRestore={canEdit}
                  onPreview={setPreviewVersion}
                  onRestored={() => setPreviewVersion(null)}
                />
              </div>
            )
          ) : (
            <div style={{ maxWidth: 680 }}>
              {/* Title */}
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEdit || view === "preview" || !!previewVersion}
                className="border-0 shadow-none focus-visible:ring-0 px-0 mb-6"
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#18181b",
                  background: "transparent",
                  borderBottom: "none",
                }}
                placeholder="Untitled document"
              />
              <RichTextEditor
                content={currentContent}
                onChange={setContent}
                editable={canEdit && view === "edit" && !previewVersion}
                className="min-h-[400px]"
              />
            </div>
          )}
        </div>

        {/* Right panel — 240px */}
        <aside
          className="shrink-0 overflow-y-auto"
          style={{
            width: 240,
            background: "#fafafa",
            borderLeft: "1px solid #e4e4e7",
            padding: 20,
          }}
        >
          {/* Details */}
          <section className="mb-6">
            <h3
              className="mb-3 uppercase"
              style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#a1a1aa" }}
            >
              Details
            </h3>
            <div className="space-y-2">
              {[
                {
                  label: "Created",
                  value: document.createdAt
                    ? format(new Date(document.createdAt), "MMM d, yyyy")
                    : "—",
                  icon: Clock,
                },
                {
                  label: "Updated",
                  value: document.updatedAt
                    ? format(new Date(document.updatedAt), "MMM d, yyyy")
                    : "—",
                  icon: FileText,
                },
                {
                  label: "Versions",
                  value: String(versions.length),
                  icon: Clock,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between">
                  <span style={{ fontSize: 12, color: "#71717a" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#18181b" }}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Tags */}
          {document.tags.length > 0 && (
            <section className="mb-6">
              <h3
                className="mb-3 uppercase flex items-center gap-1.5"
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#a1a1aa" }}
              >
                <Tag style={{ width: 10, height: 10 }} />
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {document.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2.5 py-0.5 font-semibold"
                    style={{
                      fontSize: 11,
                      background: "#f4f4f5",
                      color: "#52525b",
                      border: "1px solid #e4e4e7",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* AI Tools */}
          {/* <section>
            <h3
              className="mb-3 uppercase flex items-center gap-1.5"
              style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#a1a1aa" }}
            >
              <Sparkles style={{ width: 10, height: 10 }} />
              AI Tools
            </h3>
            <div className="space-y-1.5">
              {AI_TOOLS.map((tool) => (
                <Sheet key={tool.action}>
                  <SheetTrigger
                    className="w-full flex items-center gap-2 transition-colors text-left"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e4e4e7",
                      borderRadius: 7,
                      padding: "7px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#18181b",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#c7d2fe";
                      (e.currentTarget as HTMLButtonElement).style.background = "#eef2ff";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#e4e4e7";
                      (e.currentTarget as HTMLButtonElement).style.background = "#ffffff";
                    }}
                  >
                    <Sparkles style={{ width: 13, height: 13, color: "#818cf8" }} />
                    {tool.label}
                  </SheetTrigger>
                  <SheetContent className="w-80">
                    <SheetHeader>
                      <SheetTitle>{tool.label}</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 text-sm text-muted-foreground">
                      AI {tool.label.toLowerCase()} coming soon.
                    </div>
                  </SheetContent>
                </Sheet>
              ))}
            </div>
          </section> */}
        </aside>
      </div>
    </div>
  );
}

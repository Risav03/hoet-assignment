"use client";
import { useState, useCallback, useEffect } from "react";
import { RichTextEditor } from "./rich-text-editor";
import { DraftAutoSave, clearDraft } from "./draft-auto-save";
import { getLocalDB } from "@/lib/db/local";
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
import { ArrowLeft, Tag, Clock, FileText, PanelRight, Save, Send, X } from "lucide-react";
import { createPatch } from "@/lib/sync/differ";
import { useSSE } from "@/lib/hooks/use-sse";
import { useSyncEngine } from "@/lib/hooks/use-sync-engine";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  const [conflictDraft, setConflictDraft] = useState<string | null>(null);

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
    async function checkDraft() {
      try {
        const db = getLocalDB();
        const draft = await db.drafts.get(document.id);

        if (!draft || draft.content === document.contentSnapshot) {
          setContent(document.contentSnapshot);
          return;
        }

        const dbUpdatedAt = document.updatedAt ? new Date(document.updatedAt) : null;
        const draftSavedAt = new Date(draft.savedAt);

        if (dbUpdatedAt && dbUpdatedAt > draftSavedAt) {
          // DB was updated after the draft was saved — don't auto-restore
          setContent(document.contentSnapshot);
          setConflictDraft(draft.content);
          toast.warning("Newer changes were accepted while you had a draft", {
            id: "draft-conflict",
            duration: 8000,
            description: "Your draft is shown below for comparison.",
          });
        } else {
          // Draft is at least as recent as the DB — restore as usual
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
          setContent(draft.content);
        }
      } catch {
        setContent(document.contentSnapshot);
      }
    }
    checkDraft();
  }, [document.id, document.contentSnapshot, document.updatedAt]);

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

  /* Right-panel content (shared between persistent aside and mobile Sheet) */
  const PanelContent = (
    <div className="p-5 space-y-6">
      {/* Details */}
      <section>
        <h3 className="mb-3 uppercase text-[10px] font-bold tracking-[0.06em] text-muted-foreground">
          Details
        </h3>
        <div className="space-y-2">
          {[
            {
              label: "Created",
              value: document.createdAt ? format(new Date(document.createdAt), "MMM d, yyyy") : "—",
              icon: Clock,
            },
            {
              label: "Updated",
              value: document.updatedAt ? format(new Date(document.updatedAt), "MMM d, yyyy") : "—",
              icon: FileText,
            },
            {
              label: "Versions",
              value: String(versions.length),
              icon: Clock,
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs font-medium text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Tags */}
      {document.tags.length > 0 && (
        <section>
          <h3 className="mb-3 uppercase flex items-center gap-1.5 text-[10px] font-bold tracking-[0.06em] text-muted-foreground">
            <Tag className="w-[10px] h-[10px]" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {document.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2.5 py-0.5 font-semibold text-[11px] bg-muted text-secondary-foreground border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Top bar — mobile: two rows, desktop: single row */}
      <header className="bg-card border-b border-border shrink-0">
        {/* Row 1: breadcrumb + actions */}
        <div className="flex items-center gap-2 px-3 sm:px-6 h-[52px]">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link href={`/workspaces/${workspaceSlug ?? document.workspaceId}/documents`}>
              <button className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Documents</span>
              </button>
            </Link>
            <span className="text-border hidden sm:inline">/</span>
            <span className="truncate max-w-[140px] sm:max-w-[200px] text-[13px] font-semibold text-foreground">
              {title}
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {conflictDraft === null && (
              <DraftAutoSave
                documentId={document.id}
                workspaceId={document.workspaceId}
                content={content}
              />
            )}
            {previewVersion && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning-soft text-warning-strong border border-warning-border">
                v{previewVersion.versionNumber}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning-soft text-warning-strong border border-warning-border">
              Draft
            </span>
            {canEdit && !previewVersion && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg text-xs font-semibold h-8"
                >
                  {saving ? (
                    "Saving…"
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">Save</span>
                    </>
                  )}
                </Button>
                {membersCount > 1 ? (
                  <Button
                    size="sm"
                    onClick={handlePropose}
                    disabled={proposing}
                    className="font-semibold text-primary-foreground bg-primary rounded-lg text-xs h-8 shadow-[0_1px_2px_rgba(79,70,229,.25)]"
                  >
                    {proposing ? (
                      "Submitting…"
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Propose</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="hidden sm:inline text-xs text-muted-foreground italic">
                    Only collaborator
                  </span>
                )}
              </>
            )}

            {/* Info/panel toggle on mobile (<lg) */}
            <Sheet>
              <SheetTrigger className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <PanelRight className="w-4 h-4" />
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <SheetHeader className="px-5 pt-5 pb-0">
                  <SheetTitle>Document Info</SheetTitle>
                </SheetHeader>
                {PanelContent}
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Row 2: segmented view tabs (always visible, scrollable on tiny screens) */}
        <div className="flex items-center px-3 sm:px-6 pb-2 overflow-x-auto">
          <div className="flex items-center p-0.5 gap-0.5 bg-muted rounded-lg">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  if (v !== "history") setPreviewVersion(null);
                }}
                className={cn(
                  "transition-all font-semibold capitalize text-xs px-3.5 py-1 rounded-md whitespace-nowrap",
                  view === v
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Draft conflict comparison (shown instead of normal editor when DB is newer than draft) */}
      {conflictDraft !== null && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Banner */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 shrink-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Newer changes were accepted — comparing current version with your draft
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              onClick={() => {
                clearDraft(document.id);
                setConflictDraft(null);
              }}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Close
            </Button>
          </div>

          {/* Split panes */}
          <div className="flex max-lg:flex-col max-lg:divide-y max-lg:divide-border flex-1 overflow-hidden divide-x divide-border">
            {/* Left — current version (editable so you can merge in draft content) */}
            <div className="flex-1 overflow-y-auto bg-card px-4 py-6 sm:px-10 sm:py-10">
              <div className="max-w-[680px]">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  Latest version — editable
                </p>
                <div className="text-[28px] font-extrabold text-foreground mb-6">{title}</div>
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  editable={canEdit}
                  className="min-h-[400px]"
                />
              </div>
            </div>

            {/* Right — user's draft (read-only reference) */}
            <div className="flex-1 overflow-y-auto bg-card px-4 py-6 sm:px-10 sm:py-10">
              <div className="max-w-[680px]">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-amber-600 dark:text-amber-400">
                    Your draft
                  </p>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
                      onClick={() => {
                        setContent(conflictDraft!);
                        clearDraft(document.id);
                        setConflictDraft(null);
                      }}
                    >
                      Use draft
                    </Button>
                  )}
                </div>
                <div className="text-[28px] font-extrabold text-foreground mb-6">{title}</div>
                <RichTextEditor
                  content={conflictDraft}
                  onChange={() => {}}
                  editable={false}
                  className="min-h-[400px]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className={cn("flex flex-1 overflow-hidden", conflictDraft !== null && "hidden")}>
        {/* Main editor */}
        <div className="flex-1 overflow-y-auto bg-card px-4 py-6 sm:px-10 sm:py-10">
          {view === "history" ? (
            previewVersion ? (
              <div className="max-w-[680px]">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-foreground">Preview</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning-soft text-warning-strong border border-warning-border">
                      v{previewVersion.versionNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
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
                <div className="text-[28px] font-extrabold text-foreground mb-6">{title}</div>
                <RichTextEditor
                  content={previewVersion.contentSnapshot}
                  onChange={() => {}}
                  editable={false}
                  className="min-h-[400px]"
                />
              </div>
            ) : (
              <div className="max-w-[560px]">
                <h2 className="text-base font-bold text-foreground mb-4">Version History</h2>
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
            <div className="max-w-[680px]">
              {/* Title */}
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEdit || view === "preview" || !!previewVersion}
                className="border px-2 py-1 shadow-none focus-visible:ring-0 mb-6 text-[28px] font-extrabold text-foreground bg-transparent"
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

        {/* Right panel — always visible on lg+, hidden on smaller screens (use Sheet trigger instead) */}
        <aside className="hidden lg:block shrink-0 w-[240px] overflow-y-auto bg-secondary border-l border-border">
          {PanelContent}
        </aside>
      </div>
    </div>
  );
}

"use client";
import { useState, useCallback, useEffect } from "react";
import { RichTextEditor } from "./rich-text-editor";
import { DraftAutoSave, loadDraft, clearDraft } from "./draft-auto-save";
import { VersionTimeline } from "@/components/versions/version-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Clock, Send, Save, ArrowLeft } from "lucide-react";
import { createPatch } from "@/lib/sync/differ";
import { useSSE } from "@/lib/hooks/use-sse";
import { useSyncEngine } from "@/lib/hooks/use-sync-engine";
import Link from "next/link";

interface Document {
  id: string;
  title: string;
  workspaceId: string;
  contentSnapshot: string;
  currentVersionId?: string | null;
  tags: string[];
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

export function DocumentEditor({ document, versions, userRole, membersCount = 1, workspaceSlug }: DocumentEditorProps) {
  const router = useRouter();
  const canEdit = userRole === "OWNER" || userRole === "EDITOR";

  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.contentSnapshot);
  const [saving, setSaving] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null);

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

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-3 px-6 py-3 border-b bg-white dark:bg-slate-950 shrink-0">
        <Link href={`/workspaces/${workspaceSlug ?? document.workspaceId}/documents`}>
          <Button variant="ghost" size="sm" className="gap-1 text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-5" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!canEdit || !!previewVersion}
          className="border-0 text-lg font-semibold bg-transparent shadow-none focus-visible:ring-0 px-0 max-w-xl"
        />
        <div className="flex items-center gap-1.5 ml-auto">
          <DraftAutoSave
            documentId={document.id}
            workspaceId={document.workspaceId}
            content={content}
          />
          {previewVersion && (
            <Badge variant="secondary" className="text-xs">
              Previewing v{previewVersion.versionNumber}
            </Badge>
          )}
          {canEdit && !previewVersion && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
              {membersCount > 1 ? (
                <Button
                  size="sm"
                  onClick={handlePropose}
                  disabled={proposing}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <Send className="w-4 h-4" />
                  {proposing ? "Submitting..." : "Propose change"}
                </Button>
              ) : (
                <span className="text-xs text-slate-400 italic px-2">
                  Only collaborator — proposals disabled
                </span>
              )}
            </>
          )}
          <Sheet>
            <SheetTrigger>
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500">
                <Clock className="w-4 h-4" />
                History
              </Button>
            </SheetTrigger>
            <SheetContent className="w-80">
              <SheetHeader>
                <SheetTitle>Version History</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                {previewVersion && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-3"
                    onClick={() => setPreviewVersion(null)}
                  >
                    Exit preview
                  </Button>
                )}
                <VersionTimeline
                  versions={versions}
                  documentId={document.id}
                  currentVersionId={document.currentVersionId}
                  canRestore={canEdit}
                  onPreview={setPreviewVersion}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto min-h-screen">
          <RichTextEditor
            content={currentContent}
            onChange={setContent}
            editable={canEdit && !previewVersion}
            className="min-h-screen shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}

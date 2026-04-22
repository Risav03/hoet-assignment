"use client";
import { useEffect, useState } from "react";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { getLocalDB } from "@/lib/db/local";
import { parsePatch } from "@/lib/sync/differ";
import { cn } from "@/lib/utils";
import { AlertTriangle, Database, GitPullRequest, FileEdit } from "lucide-react";

interface ProposalDiffProps {
  documentId: string;
  documentTitle: string;
  /** Current content stored in the database */
  dbContent: string;
  /** Raw patch string from the proposal (JSON-encoded ContentPatch) */
  rawPatch: string;
  /** Optional base version the author branched from */
  baseVersion?: {
    id: string;
    contentSnapshot: string;
    versionNumber: number;
  } | null;
}

interface PaneConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  content: string;
  accent: string;
  note?: string;
}

export function ProposalDiff({
  documentId,
  documentTitle,
  dbContent,
  rawPatch,
  baseVersion,
}: ProposalDiffProps) {
  const [localDraft, setLocalDraft] = useState<string | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);

  useEffect(() => {
    async function fetchDraft() {
      try {
        const db = getLocalDB();
        const draft = await db.drafts.get(documentId);
        setLocalDraft(draft?.content ?? null);
      } catch {
        setLocalDraft(null);
      } finally {
        setDraftChecked(true);
      }
    }
    fetchDraft();
  }, [documentId]);

  const proposedContent = parsePatch(rawPatch).content ?? dbContent;

  const isProposedSameAsDb = proposedContent === dbContent;
  const hasDraft = draftChecked && localDraft !== null;
  const isDraftSameAsProposed = hasDraft && localDraft === proposedContent;
  const isDraftSameAsDb = hasDraft && localDraft === dbContent;

  const panes: PaneConfig[] = [
    {
      key: "db",
      label: "Current (database)",
      icon: Database,
      content: dbContent,
      accent: "border-border bg-muted/30",
      note: isProposedSameAsDb ? "No content changes — this proposal is identical to the current document." : undefined,
    },
    {
      key: "proposed",
      label: "Proposed changes",
      icon: GitPullRequest,
      content: proposedContent,
      accent: "border-primary/30 bg-primary/5",
    },
    ...(hasDraft
      ? [
          {
            key: "draft",
            label: "Your local draft",
            icon: FileEdit,
            content: localDraft!,
            accent: "border-amber-300/60 bg-amber-50/40 dark:border-amber-700/50 dark:bg-amber-950/20",
            note: isDraftSameAsProposed
              ? "Your draft matches the proposed content."
              : isDraftSameAsDb
              ? "Your draft matches the current database content."
              : undefined,
          } satisfies PaneConfig,
        ]
      : []),
  ];

  if (!draftChecked) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">
        Loading diff…
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Staleness warning: base version doesn't match current DB */}
      {baseVersion && baseVersion.contentSnapshot !== dbContent && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            This proposal was based on{" "}
            <strong>v{baseVersion.versionNumber}</strong>, but the document has
            since been updated. The proposed changes may conflict with the
            current content.
          </span>
        </div>
      )}

      {/* Diff panes */}
      <div
        className={cn(
          "grid gap-3",
          panes.length === 3
            ? "grid-cols-1 lg:grid-cols-3"
            : "grid-cols-1 lg:grid-cols-2"
        )}
      >
        {panes.map(({ key, label, icon: Icon, content, accent, note }) => (
          <div
            key={key}
            className={cn(
              "flex flex-col rounded-xl border overflow-hidden",
              accent
            )}
          >
            {/* Pane header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-card/60 shrink-0">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                {label}
              </span>
              {key === "proposed" && (
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {documentTitle}
                </span>
              )}
            </div>

            {/* Warning note inside pane */}
            {note && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground bg-muted/60 border-b italic">
                {note}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto max-h-[480px]">
              <RichTextEditor
                content={content}
                onChange={() => {}}
                editable={false}
                className="border-0 rounded-none min-h-[200px] bg-transparent"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

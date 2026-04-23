"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Content, Editor } from "@tiptap/core";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Collaboration from "@tiptap/extension-collaboration";
import { Extension } from "@tiptap/core";
import * as Y from "yjs";
import { createYDoc, destroyYDoc } from "@/lib/yjs/doc";
import { DocAwareness } from "@/lib/yjs/awareness";
import { createRemoteCursorPlugin } from "@/lib/yjs/cursor-plugin";
import { useYjsSync } from "@/lib/hooks/use-yjs-sync";
import { useDocPresence } from "@/lib/hooks/use-doc-presence";
import { getLocalDB } from "@/lib/db/local";
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
import {
  ArrowLeft,
  Clock,
  FileText,
  PanelRight,
  WifiOff,
  Loader2,
  CheckCircle2,
  Clock3,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DocMeta } from "@/lib/types/document";

interface VersionEntry {
  id: string;
  rev: number;
  createdAt: string;
}

interface DocumentEditorProps {
  document: DocMeta;
  initialContent: unknown;
  versions: VersionEntry[];
  userRole: "OWNER" | "EDITOR" | "VIEWER";
  workspaceSlug?: string;
  currentUser: { id: string; name: string };
}

type EditorView = "edit" | "preview" | "history";

export function DocumentEditor({
  document,
  initialContent,
  versions,
  userRole,
  workspaceSlug,
  currentUser,
}: DocumentEditorProps) {
  const router = useRouter();
  const canEdit = userRole === "OWNER" || userRole === "EDITOR";

  const [title, setTitle] = useState(document.title);
  const [view, setView] = useState<EditorView>("edit");
  const [previewContent, setPreviewContent] = useState<unknown | null>(null);
  const [previewRev, setPreviewRev] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ydocReady, setYdocReady] = useState(false);
  // Live versions list — starts from SSR prop, refreshed whenever the history
  // tab is opened or a new snapshot is confirmed by the server.
  const [liveVersions, setLiveVersions] = useState(versions);
  const [liveCurrentRev, setLiveCurrentRev] = useState(document.currentRev);

  // Stable per-session presence color derived from the userId
  const presenceColor = useMemo(() => userIdToColor(currentUser.id), [currentUser.id]);

  // Awareness shim — created once, lives as long as the component
  const awarenessRef = useRef<DocAwareness | null>(null);
  if (!awarenessRef.current) {
    awarenessRef.current = new DocAwareness();
  }

  // Yjs document — created once per document, destroyed on unmount
  const ydocHandleRef = useRef<ReturnType<typeof createYDoc> | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);

  useEffect(() => {
    const handle = createYDoc(document.id);
    ydocHandleRef.current = handle;
    ydocRef.current = handle.ydoc;

    // Once IndexedDB has loaded persisted state, mark ready so the editor
    // can be initialised with the correct content.
    handle.synced.then(() => setYdocReady(true)).catch(() => setYdocReady(true));

    return () => {
      void destroyYDoc(handle);
      ydocHandleRef.current = null;
      ydocRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/docs/${document.id}/versions`);
      if (!res.ok) return;
      const data = await res.json() as { versions: VersionEntry[]; currentRev: number };
      setLiveVersions(data.versions);
      if (typeof data.currentRev === "number") {
        setLiveCurrentRev(data.currentRev);
      }
    } catch {
      // non-fatal — stale list is still usable
    }
  }, [document.id]);

  // Yjs sync engine: outbox flush + SSE ingestion
  const { isSyncing, isOffline, pendingCount, initialSyncDone } = useYjsSync({
    ydoc: ydocRef.current,
    docId: document.id,
    onInitialSync: () => {
      // Nothing extra needed — Collaboration extension reacts to ydoc changes
    },
    // Provide current Tiptap JSON so the server can write DocumentSnapshot
    // entries that keep the history panel up-to-date.
    getSnapshot: () => editor?.getJSON(),
    // Refresh the versions list as soon as the server confirms a new snapshot.
    onSnapshotSaved: fetchVersions,
  });

  // Only render sync-state UI after client mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Tiptap editor — the Collaboration extension binds directly to the Y.Doc
  // so all edits are automatically captured as Yjs updates.
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        StarterKit.configure({ history: false } as any),
        TextStyle,
        Color,
        Underline,
        Placeholder.configure({ placeholder: "Start writing…" }),
        ...(ydocReady && ydocRef.current && awarenessRef.current
          ? [
              Collaboration.configure({
                document: ydocRef.current,
                field: "document",
              }),
              // Custom extension that adds the remote-cursor ProseMirror plugin.
              // Uses absolute anchor/head positions from SSE presence events so
              // we don't need y-protocols relative positions.
              Extension.create({
                name: "remoteCursors",
                addProseMirrorPlugins: () => [
                  createRemoteCursorPlugin(awarenessRef.current!),
                ],
              }),
            ]
          : []),
      ],
      editable: canEdit && view === "edit",
    },
    [ydocReady]
  );

  useEffect(() => {
    editor?.setEditable(canEdit && view === "edit");
  }, [canEdit, view, editor]);

  // Broadcast local cursor position and receive remote cursors via SSE
  useDocPresence({
    docId: document.id,
    editor,
    awareness: awarenessRef.current!,
    userId: currentUser.id,
    userName: currentUser.name,
    color: presenceColor,
  });

  // If the Y.Doc has no content yet (brand-new or legacy document), seed it
  // from the server-side `initialContent` via Tiptap so the Collaboration
  // extension writes the correct Y.XmlFragment type — never touch the Y.Doc
  // directly with getText() which would register the wrong type.
  //
  // IMPORTANT: wait for initialSyncDone before checking yXml.length.
  // If we seed before the server's Yjs updates arrive, setContent creates a
  // new Yjs operation (new clock timestamp) that later conflicts with the
  // identical server operation — producing duplicated content blocks.
  useEffect(() => {
    if (!ydocReady || !initialSyncDone || !ydocRef.current || !editor) return;

    // The Collaboration extension binds to a Y.XmlFragment, not Y.Text.
    const yXml = ydocRef.current.getXmlFragment("document");
    if (yXml.length === 0 && initialContent) {
      editor.commands.setContent(jsonToTiptap(initialContent));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ydocReady, initialSyncDone, editor]);

  // Handle title save
  const handleTitleBlur = useCallback(async () => {
    if (!canEdit || title === document.title) return;
    try {
      await fetch(`/api/docs/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {
      toast.error("Failed to save title");
    }
  }, [canEdit, document.id, document.title, title]);

  // Load preview at a specific rev
  const handlePreviewRev = useCallback(async (rev: number) => {
    try {
      const res = await fetch(`/api/docs/${document.id}/versions?rev=${rev}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { content: unknown };
      setPreviewContent(data.content);
      setPreviewRev(rev);
      setView("history");
    } catch {
      toast.error("Failed to load version");
    }
  }, [document.id]);

  // Restore to a rev
  const handleRestore = useCallback(async (rev: number) => {
    try {
      const res = await fetch(`/api/docs/${document.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRev: rev }),
      });
      if (!res.ok) throw new Error();

      // Clear local Yjs state so the fresh page load seeds from the restored
      // snapshot rather than replaying stale updates over the top of it.
      try {
        // 1. Drop all queued outbox entries for this doc
        const localDb = getLocalDB();
        await localDb.yUpdates.where({ docId: document.id }).delete();

        // 2. Wipe the IndexedDB persistence store used by y-indexeddb
        if (ydocHandleRef.current) {
          await ydocHandleRef.current.persistence.clearData();
        }
      } catch {
        // Non-fatal — page reload is still the right action
      }

      toast.success(`Restored to v${rev}`);
      window.location.reload();
    } catch {
      toast.error("Failed to restore version");
    }
  }, [document.id]);

  const VIEWS: EditorView[] = ["edit", "preview", "history"];

  const SyncBadge = () => {
    if (!mounted) return null;
    if (isOffline) return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <WifiOff className="w-3 h-3" />
        Offline
      </span>
    );
    if (isSyncing) return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
        <Loader2 className="w-3 h-3 animate-spin" />
        Syncing
      </span>
    );
    if (pendingCount > 0) return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
        <Clock3 className="w-3 h-3" />
        {pendingCount} pending
      </span>
    );
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800">
        <CheckCircle2 className="w-3 h-3" />
        Saved
      </span>
    );
  };

  const PanelContent = (
    <div className="p-5 space-y-6">
      <section>
        <h3 className="mb-3 uppercase text-[10px] font-bold tracking-[0.06em] text-muted-foreground">
          Details
        </h3>
        <div className="space-y-2">
          {[
            { label: "Created", value: format(new Date(document.createdAt), "MMM d, yyyy"), icon: Clock },
            { label: "Updated", value: format(new Date(document.updatedAt), "MMM d, yyyy"), icon: FileText },
            { label: "Revision", value: `v${liveCurrentRev}`, icon: Clock },
            { label: "Snapshots", value: String(liveVersions.length), icon: Clock },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs font-medium text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Header */}
      <header className="bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2 px-3 sm:px-6 h-[52px]">
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

          <div className="flex items-center gap-2 shrink-0">
            <SyncBadge />
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

        {/* View tabs */}
        <div className="flex items-center px-3 sm:px-6 pb-2">
          <div className="flex items-center p-0.5 gap-0.5 bg-muted rounded-lg">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  if (v === "history") {
                    void fetchVersions();
                  } else {
                    setPreviewContent(null);
                    setPreviewRev(null);
                  }
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

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-card px-4 py-6 sm:px-10 sm:py-10">
          {view === "history" ? (
            <HistoryPanel
              docId={document.id}
              versions={liveVersions}
              previewContent={previewContent}
              previewRev={previewRev}
              canRestore={canEdit}
              onPreview={handlePreviewRev}
              onRestore={handleRestore}
              onBack={() => { setPreviewContent(null); setPreviewRev(null); }}
            />
          ) : (
            <div className="max-w-[720px]">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                disabled={!canEdit || view === "preview"}
                className="border-0 border-b px-0 shadow-none focus-visible:ring-0 mb-6 text-[28px] font-extrabold text-foreground bg-transparent rounded-none"
                placeholder="Untitled document"
              />
              <div className={cn(
                "flex flex-col border rounded-lg overflow-hidden bg-card",
                view === "preview" && "opacity-80"
              )}>
                {canEdit && view === "edit" && (
                  <EditorToolbar editor={editor} />
                )}
                {!ydocReady ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : (
                  <EditorContent editor={editor} className="flex-1" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <aside className="hidden lg:block shrink-0 w-[240px] overflow-y-auto bg-secondary border-l border-border">
          {PanelContent}
        </aside>
      </div>
    </div>
  );
}

// ── Formatting toolbar ─────────────────────────────────────────────────────────

function ToolbarDivider() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      title={title}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-7 h-7 rounded text-sm transition-colors shrink-0",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2.5 py-1.5 border-b border-border bg-muted/40 sticky top-0 z-10">
      {/* Undo / Redo — provided by Yjs UndoManager via Collaboration extension */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Text style */}
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <Code className="w-3.5 h-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <Heading3 className="w-3.5 h-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered list"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Block types */}
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        <Quote className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code block"
      >
        <Code2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus className="w-3.5 h-3.5" />
      </ToolbarButton>
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  docId,
  versions,
  previewContent,
  previewRev,
  canRestore,
  onPreview,
  onRestore,
  onBack,
}: {
  docId: string;
  versions: VersionEntry[];
  previewContent: unknown | null;
  previewRev: number | null;
  canRestore: boolean;
  onPreview: (rev: number) => void;
  onRestore: (rev: number) => void;
  onBack: () => void;
}) {
  if (previewContent !== null && previewRev !== null) {
    return (
      <div className="max-w-[680px]">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">Preview</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning-soft text-warning-strong border border-warning-border">
              v{previewRev}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canRestore && (
              <Button variant="outline" size="sm" onClick={() => onRestore(previewRev)}>
                Restore this version
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onBack}>
              Back to history
            </Button>
          </div>
        </div>
        <div
          className="prose prose-sm max-w-none dark:prose-invert px-4 py-4"
          dangerouslySetInnerHTML={{ __html: jsonToHtml(previewContent) }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[560px]">
      <h2 className="text-base font-bold mb-4">Version History</h2>
      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No snapshots yet. They are created automatically every 100 edits.</p>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div>
                <span className="text-sm font-semibold text-foreground">v{v.rev}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {format(new Date(v.createdAt), "MMM d, yyyy HH:mm")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => onPreview(v.rev)}
                >
                  Preview
                </Button>
                {canRestore && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => onRestore(v.rev)}
                  >
                    Restore
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derives a deterministic, visually-distinct hex colour from a user id. */
function userIdToColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(31, hash) + userId.charCodeAt(i)) | 0;
  }
  // Restrict lightness to a readable mid-range so the label stays visible on
  // both light and dark editor backgrounds.
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 45%)`;
}

function jsonToTiptap(content: unknown): Content {
  if (!content) return "";
  if (typeof content === "object") return content as Content;
  if (typeof content === "string") {
    try {
      return JSON.parse(content) as Content;
    } catch {
      return content;
    }
  }
  return "";
}

const PREVIEW_EXTENSIONS = [StarterKit, Color, TextStyle, Underline];

function jsonToHtml(content: unknown): string {
  if (!content) return "";
  try {
    const json = typeof content === "string" ? JSON.parse(content) : content;
    return generateHTML(json as Parameters<typeof generateHTML>[0], PREVIEW_EXTENSIONS);
  } catch {
    return "";
  }
}

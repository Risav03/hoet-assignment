"use client";
import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { DocAwareness, userIdToNumericId } from "@/lib/yjs/awareness";
import { remoteCursorPluginKey } from "@/lib/yjs/cursor-plugin";

const BROADCAST_DEBOUNCE_MS = 300;
/** After this many ms with no update we remove the remote user's cursor. */
const PRESENCE_TIMEOUT_MS = 10_000;

interface UseDocPresenceOptions {
  docId: string;
  editor: Editor | null;
  awareness: DocAwareness;
  userId: string;
  userName: string;
  color: string;
}

/** Dispatch a meta-transaction so the remoteCursorPlugin rebuilds its decorations. */
function triggerCursorRedraw(editor: Editor): void {
  try {
    editor.view.dispatch(
      editor.state.tr.setMeta(remoteCursorPluginKey, true)
    );
  } catch {
    // view may be destroyed
  }
}

/**
 * Manages document-level cursor presence:
 *
 * 1. Watches editor `selectionUpdate` events and debounces POST requests to
 *    /api/docs/:docId/presence so the server can broadcast to other clients.
 *
 * 2. Listens to the SSE doc channel for `doc_presence` events from remote
 *    collaborators, updates the DocAwareness state, then triggers the custom
 *    ProseMirror cursor plugin to redraw decorations at the new positions.
 */
export function useDocPresence({
  docId,
  editor,
  awareness,
  userId,
  userName,
  color,
}: UseDocPresenceOptions): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Map from userId → timeout handle for presence expiry
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Stable ref to the editor so the SSE closure always sees the latest instance
  const editorRef = useRef<Editor | null>(editor);
  editorRef.current = editor;

  // ── Broadcast local cursor ─────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return;

    const sendPresence = () => {
      const { from, to } = editor.state.selection;
      void fetch(`/api/docs/${docId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anchor: from, head: to, userName, color }),
      }).catch(() => {
        // non-fatal — cursor just won't show for this update
      });
    };

    const handleSelectionUpdate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(sendPresence, BROADCAST_DEBOUNCE_MS);
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor, docId, userName, color]);

  // ── Set local awareness state so our own cursor is visible to us ──────────
  useEffect(() => {
    awareness.setLocalStateField("user", { name: userName, color });
  }, [awareness, userName, color]);

  // ── SSE listener for remote cursors ───────────────────────────────────────
  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const es = new EventSource(`/api/events?docId=${encodeURIComponent(docId)}`);

    const handlePresence = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as {
          payload?: {
            userId?: string;
            userName?: string;
            color?: string;
            anchor?: number;
            head?: number;
          };
        };
        const p = data.payload;
        if (!p?.userId || p.userId === userId) return; // skip own events

        const remoteUserId = p.userId; // narrowed to string
        const numericId = userIdToNumericId(remoteUserId);

        awareness.updateRemote(numericId, {
          user: { name: p.userName ?? "Unknown", color: p.color ?? "#888888" },
          cursor: typeof p.anchor === "number" && typeof p.head === "number"
            ? { anchor: p.anchor, head: p.head }
            : null,
        });

        // Ask the ProseMirror cursor plugin to redraw decorations
        if (editorRef.current) triggerCursorRedraw(editorRef.current);

        // Refresh presence expiry timer
        const existingTimeout = timeoutRefs.current.get(remoteUserId);
        if (existingTimeout) clearTimeout(existingTimeout);
        timeoutRefs.current.set(
          remoteUserId,
          setTimeout(() => {
            awareness.removeRemote(numericId);
            if (editorRef.current) triggerCursorRedraw(editorRef.current);
            timeoutRefs.current.delete(remoteUserId);
          }, PRESENCE_TIMEOUT_MS)
        );
      } catch {
        // ignore malformed events
      }
    };

    es.addEventListener("doc_presence", handlePresence);

    return () => {
      es.removeEventListener("doc_presence", handlePresence);
      es.close();
      for (const t of timeoutRefs.current.values()) clearTimeout(t);
      timeoutRefs.current.clear();
    };
  }, [docId, userId, awareness]);
}

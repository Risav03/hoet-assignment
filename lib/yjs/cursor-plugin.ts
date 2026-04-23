"use client";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState } from "@tiptap/pm/state";
import type { DocAwareness, AwarenessState } from "./awareness";

export const remoteCursorPluginKey = new PluginKey<DecorationSet>("remoteCursors");

function buildDecorations(state: EditorState, awareness: DocAwareness): DecorationSet {
  const decorations: Decoration[] = [];
  const maxPos = state.doc.content.size;

  for (const [clientId, userData] of awareness.states) {
    // Skip the local user's own entry
    if (clientId === awareness.clientID) continue;

    const user = userData.user;
    const cursor = (userData as AwarenessState & { cursor?: { anchor: number; head: number } | null }).cursor;

    if (!user || !cursor) continue;

    const safeAnchor = Math.min(Math.max(cursor.anchor, 0), maxPos);
    const safeHead = Math.min(Math.max(cursor.head, 0), maxPos);

    // Caret widget at the head position
    const widget = document.createElement("span");
    widget.classList.add("collaboration-cursor__caret");
    widget.setAttribute("style", `border-color: ${user.color}`);

    const label = document.createElement("div");
    label.classList.add("collaboration-cursor__label");
    label.setAttribute("style", `background-color: ${user.color}`);
    label.textContent = user.name;
    widget.appendChild(label);

    decorations.push(Decoration.widget(safeHead, widget, { key: `cursor-${clientId}` }));

    // Selection highlight when anchor ≠ head
    if (safeAnchor !== safeHead) {
      const from = Math.min(safeAnchor, safeHead);
      const to = Math.max(safeAnchor, safeHead);
      decorations.push(
        Decoration.inline(
          from,
          to,
          {
            class: "collaboration-cursor__selection",
            style: `background-color: ${user.color}33`, // ~20% opacity tint
          },
          { key: `selection-${clientId}` }
        )
      );
    }
  }

  return DecorationSet.create(state.doc, decorations);
}

/**
 * A ProseMirror plugin that renders remote collaborator cursors as decorations.
 *
 * - Cursor positions are absolute ProseMirror positions (anchor + head).
 * - The plugin rebuilds decorations whenever a `remoteCursorPluginKey` meta
 *   transaction is dispatched (triggered by useDocPresence on SSE events).
 * - On `docChanged` it maps existing decorations through the new position
 *   mapping so they stay roughly in place between SSE ticks.
 */
export function createRemoteCursorPlugin(awareness: DocAwareness): Plugin {
  return new Plugin<DecorationSet>({
    key: remoteCursorPluginKey,

    state: {
      init(_config, state) {
        return buildDecorations(state, awareness);
      },
      apply(tr, prevDecorations, _oldState, newState) {
        // Full rebuild when the awareness state has changed
        if (tr.getMeta(remoteCursorPluginKey)) {
          return buildDecorations(newState, awareness);
        }
        // Map through document changes so decorations don't jump
        if (tr.docChanged) {
          return prevDecorations.map(tr.mapping, tr.doc);
        }
        return prevDecorations;
      },
    },

    props: {
      decorations(state) {
        return remoteCursorPluginKey.getState(state);
      },
    },
  });
}

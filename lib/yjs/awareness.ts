"use client";

/**
 * Minimal awareness shim for @tiptap/extension-collaboration-cursor.
 *
 * The real y-protocols Awareness object requires a WebSocket provider; we
 * replicate only the subset of its interface that CollaborationCursor reads:
 *   - getLocalState()
 *   - setLocalStateField(field, value)
 *   - getStates() → Map<number, AwarenessState>
 *   - on("change", handler) / off("change", handler)
 *
 * Remote collaborator states are injected via updateRemote() when a
 * doc_presence SSE event arrives.
 */

export interface AwarenessUser {
  name: string;
  color: string;
}

export interface AwarenessCursor {
  anchor: number;
  head: number;
}

export interface AwarenessState {
  user?: AwarenessUser;
  cursor?: AwarenessCursor | null;
  [key: string]: unknown;
}

type ChangeHandler = (changes: {
  added: number[];
  updated: number[];
  removed: number[];
}) => void;

// Generic handler for any event (used for 'update' events)
type GenericHandler = (...args: unknown[]) => void;

export class DocAwareness {
  /** Numeric client id for the local user (random, stable per instance). */
  readonly clientID: number;

  private localState: AwarenessState = {};
  private remoteStates = new Map<number, AwarenessState>();
  private handlers = new Map<string, Set<GenericHandler>>();

  constructor() {
    this.clientID = Math.floor(Math.random() * 0xffffffff);
  }

  // ── Public property required by y-prosemirror / CollaborationCursor ────────

  /**
   * The full awareness state map — includes both the local user and all
   * remote collaborators. `yCursorPlugin` reads this directly as a property.
   */
  get states(): Map<number, AwarenessState> {
    const all = new Map(this.remoteStates);
    if (Object.keys(this.localState).length > 0) {
      all.set(this.clientID, this.localState);
    }
    return all;
  }

  // ── CollaborationCursor API ────────────────────────────────────────────────

  getLocalState(): AwarenessState | null {
    return Object.keys(this.localState).length > 0 ? this.localState : null;
  }

  setLocalStateField(field: string, value: unknown): void {
    this.localState = { ...this.localState, [field]: value };
    const changes = { added: [], updated: [this.clientID], removed: [] };
    this.emit("change", changes);
    this.emit("update", changes);
  }

  /** Alias for compatibility with code that calls getStates() directly. */
  getStates(): Map<number, AwarenessState> {
    return this.states;
  }

  on(event: string, handler: GenericHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: GenericHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  // ── Called by useDocPresence when a remote presence SSE event arrives ──────

  /**
   * Upsert a remote collaborator's state.
   * `numericId` should be a stable numeric id derived from their userId
   * (e.g. a hash) so that subsequent updates replace rather than add.
   */
  updateRemote(numericId: number, state: AwarenessState): void {
    const isNew = !this.remoteStates.has(numericId);
    this.remoteStates.set(numericId, state);
    const changes = {
      added: isNew ? [numericId] : [],
      updated: isNew ? [] : [numericId],
      removed: [],
    };
    this.emit("change", changes);
    this.emit("update", changes);
  }

  /**
   * Remove a remote collaborator (e.g. they closed their tab).
   */
  removeRemote(numericId: number): void {
    if (this.remoteStates.delete(numericId)) {
      const changes = { added: [], updated: [], removed: [numericId] };
      this.emit("change", changes);
      this.emit("update", changes);
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    for (const h of this.handlers.get(event) ?? []) {
      try {
        h(...args);
      } catch {
        // ignore handler errors
      }
    }
  }
}

/**
 * Convert a userId string to a stable 31-bit integer suitable as a Yjs
 * client-id equivalent (must be positive and < 2^31).
 */
export function userIdToNumericId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(31, hash) + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 0x7fffffff || 1;
}

"use client";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

export interface YDocHandle {
  ydoc: Y.Doc;
  persistence: IndexeddbPersistence;
  /** Resolves once the initial IndexedDB state has been loaded into the doc. */
  synced: Promise<void>;
}

/**
 * Create a Yjs document backed by IndexedDB persistence.
 *
 * Each document is keyed by `docId` in IndexedDB so multiple documents
 * can coexist without conflict.  The `synced` promise resolves as soon as
 * the persisted state has been applied — await it before rendering editor
 * content to avoid a flash of empty content.
 */
export function createYDoc(docId: string): YDocHandle {
  const ydoc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`yjs:${docId}`, ydoc);

  const synced = new Promise<void>((resolve) => {
    persistence.once("synced", () => {
      resolve();
    });
  });

  return { ydoc, persistence, synced };
}

/**
 * Destroy a YDocHandle, flushing and closing both the Y.Doc and the
 * IndexedDB provider.  Call this in cleanup effects to avoid memory leaks.
 */
export async function destroyYDoc(handle: YDocHandle): Promise<void> {
  try {
    await handle.persistence.destroy();
  } catch {
    // ignore — may already be closed
  }
  handle.ydoc.destroy();
}

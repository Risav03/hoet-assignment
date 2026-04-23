"use client";
import Dexie, { type Table } from "dexie";
import type { CanvasNode, CanvasEdge, CanvasOp } from "@/lib/types/canvas";
import type { Operation as JSONPatchOp } from "fast-json-patch";

// ── Canvas types ──────────────────────────────────────────────────────────────

export interface LocalBoardOp {
  id?: number;
  operationId: string;
  boardId: string;
  workspaceId: string;
  userId: string;
  op: CanvasOp;
  status: "pending" | "syncing" | "committed" | "rejected";
  retryCount: number;
  createdAt: string;
  processedAt?: string;
}

export interface LocalBoardSnapshot {
  id: string;
  workspaceId: string;
  title: string;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  isArchived: boolean;
  snapshotAt: string;
}

// ── Document types ─────────────────────────────────────────────────────────────

export type DocOpStatus = "pending" | "sent" | "acked" | "failed";

export interface LocalDoc {
  docId: string;
  workspaceId: string;
  title: string;
  lastKnownServerRev: number;
  lastLocalRev: number;
  isDirty: boolean;
  updatedAt: string;
}

export interface LocalDocOp {
  id?: number;
  opId: string;
  docId: string;
  clientId: string;
  baseRev: number;
  diff: JSONPatchOp[];
  createdAt: string;
  status: DocOpStatus;
}

export interface LocalDocSnapshot {
  snapshotId: string;
  docId: string;
  rev: number;
  content: unknown;
  createdAt: string;
}

export interface LocalDocOutboxEntry {
  opId: string;
  docId: string;
  retryCount: number;
  nextRetryAt: string;
}

// ── Legacy stubs (kept for backward compat with editor/sync components) ───────

/** @deprecated Document model removed from DB */
export interface LocalDocument {
  id: string;
  workspaceId: string;
  title: string;
  contentSnapshot: string;
  tags: string[];
  isArchived: boolean;
  currentVersionId?: string;
  updatedAt: string;
  syncedAt?: string;
}

/** @deprecated Document model removed from DB */
export interface LocalDraft {
  id: string;
  documentId: string;
  workspaceId: string;
  content: string;
  savedAt: string;
}

/** @deprecated Use LocalBoardOp instead */
export interface LocalSyncOperation {
  id?: number;
  operationId: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  operationType: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  retryCount: number;
  clientChecksum?: string;
  createdAt: string;
  processedAt?: string;
}

/** @deprecated Use Prisma proposals instead */
export interface LocalProposal {
  id: string;
  documentId: string;
  workspaceId: string;
  authorId: string;
  baseVersionId?: string;
  patch: string;
  proposalType: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "COMMITTED";
  createdAt: string;
  syncedAt?: string;
}

// ── Database class ─────────────────────────────────────────────────────────────

class CanvasLocalDB extends Dexie {
  // Canvas tables
  boardOps!: Table<LocalBoardOp, number>;
  boardSnapshots!: Table<LocalBoardSnapshot, string>;
  // Document tables
  docMeta!: Table<LocalDoc, string>;
  docOps!: Table<LocalDocOp, number>;
  docSnapshots!: Table<LocalDocSnapshot, string>;
  docOutbox!: Table<LocalDocOutboxEntry, string>;
  // Legacy tables (kept so old Dexie migrations don't error)
  documents!: Table<LocalDocument, string>;
  drafts!: Table<LocalDraft, string>;
  syncQueue!: Table<LocalSyncOperation, number>;
  proposals!: Table<LocalProposal, string>;

  constructor() {
    super("CanvasDB");
    this.version(1).stores({
      boardOps: "++id, operationId, boardId, workspaceId, status, createdAt",
      boardSnapshots: "id, workspaceId, snapshotAt",
      documents: "id, workspaceId, updatedAt, isArchived",
      drafts: "id, documentId, workspaceId, savedAt",
      syncQueue: "++id, operationId, workspaceId, documentId, status, createdAt",
      proposals: "id, workspaceId, documentId, status, createdAt",
    });
    this.version(2).stores({
      boardOps: "++id, operationId, boardId, workspaceId, status, createdAt",
      boardSnapshots: "id, workspaceId, snapshotAt",
      docMeta: "docId, workspaceId, isDirty, updatedAt",
      docOps: "++id, opId, docId, status, createdAt",
      docSnapshots: "snapshotId, docId, rev",
      docOutbox: "opId, docId, nextRetryAt",
      documents: "id, workspaceId, updatedAt, isArchived",
      drafts: "id, documentId, workspaceId, savedAt",
      syncQueue: "++id, operationId, workspaceId, documentId, status, createdAt",
      proposals: "id, workspaceId, documentId, status, createdAt",
    });
  }
}

let _canvasDB: CanvasLocalDB | undefined;

export function getLocalDB(): CanvasLocalDB {
  if (typeof window === "undefined") throw new Error("LocalDB only available in browser");
  if (!_canvasDB) _canvasDB = new CanvasLocalDB();
  return _canvasDB;
}

/** @deprecated Use getLocalDB() */
export const getCanvasDB = getLocalDB;

export const localDB = new Proxy({} as CanvasLocalDB, {
  get(_, prop) {
    const db = getLocalDB();
    const val = (db as unknown as Record<string | symbol, unknown>)[prop];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof val === "function" ? (val as (...args: any[]) => unknown).bind(db) : val;
  },
});

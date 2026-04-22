"use client";
import Dexie, { type Table } from "dexie";

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

export interface LocalDraft {
  id: string;
  documentId: string;
  workspaceId: string;
  content: string;
  savedAt: string;
}

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

class CoWorkLocalDB extends Dexie {
  documents!: Table<LocalDocument, string>;
  drafts!: Table<LocalDraft, string>;
  syncQueue!: Table<LocalSyncOperation, number>;
  proposals!: Table<LocalProposal, string>;

  constructor() {
    super("CoWorkDB");
    this.version(1).stores({
      documents: "id, workspaceId, updatedAt, isArchived",
      drafts: "id, documentId, workspaceId, savedAt",
      syncQueue: "++id, operationId, workspaceId, documentId, status, createdAt",
      proposals: "id, workspaceId, documentId, status, createdAt",
    });
  }
}

let _localDB: CoWorkLocalDB | undefined;

export function getLocalDB(): CoWorkLocalDB {
  if (typeof window === "undefined") throw new Error("LocalDB only available in browser");
  if (!_localDB) _localDB = new CoWorkLocalDB();
  return _localDB;
}

export const localDB = new Proxy({} as CoWorkLocalDB, {
  get(_, prop) {
    const db = getLocalDB();
    const val = (db as unknown as Record<string | symbol, unknown>)[prop];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof val === "function" ? (val as (...args: any[]) => unknown).bind(db) : val;
  },
});

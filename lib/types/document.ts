import type { Operation as JSONPatchOp } from "fast-json-patch";

// ── Op status ──────────────────────────────────────────────────────────────────

export type DocOpStatus = "pending" | "sent" | "acked" | "failed";

// ── A single local operation (client-side) ────────────────────────────────────

export interface DocOp {
  opId: string;
  docId: string;
  clientId: string;
  baseRev: number;
  diff: JSONPatchOp[];
  createdAt: string;
  status: DocOpStatus;
}

// ── Conflict record returned by the server ────────────────────────────────────

export interface DocConflict {
  id: string;
  documentId: string;
  baseRev: number;
  localOp: DocOp;
  remoteOp: DocOp;
  status: "PENDING" | "RESOLVED";
}

// ── Sync wire types ───────────────────────────────────────────────────────────

export interface SyncOpPayload {
  opId: string;
  clientId: string;
  baseRev: number;
  diff: JSONPatchOp[];
  createdAt: string;
}

export interface SyncRequest {
  clientId: string;
  baseRev: number;
  ops: SyncOpPayload[];
}

export interface SyncResponse {
  acceptedOps: string[];
  remoteOps: SyncOpPayload[];
  conflicts: DocConflict[];
  newRev: number;
}

// ── Server-side document (API response shape) ─────────────────────────────────

export interface DocMeta {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  currentRev: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocSnapshot {
  id: string;
  documentId: string;
  rev: number;
  content: unknown;
  createdAt: string;
}

// ── Conflict resolution request ───────────────────────────────────────────────

export type ConflictResolution = "accept_local" | "accept_remote";

export interface ResolveConflictRequest {
  conflictId: string;
  resolution: ConflictResolution;
}

// ── Restore request ───────────────────────────────────────────────────────────

export interface RestoreRequest {
  targetRev: number;
}

export interface RestoreResponse {
  newRev: number;
  snapshotId: string;
}

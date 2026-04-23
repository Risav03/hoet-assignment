import type { OTOpType } from "@/lib/ot/types";

// ── Op status ──────────────────────────────────────────────────────────────────

export type DocOpStatus = "pending" | "sent" | "acked" | "failed";

// ── A single local operation (client-side) ────────────────────────────────────

export interface DocOp {
  opId: string;
  docId: string;
  clientId: string;
  baseRev: number;
  type: OTOpType;
  position: number;
  text?: string;
  length?: number;
  createdAt: string;
  status: DocOpStatus;
}

// ── Sync wire types ───────────────────────────────────────────────────────────

export interface SyncOpPayload {
  opId: string;
  clientId: string;
  baseRev: number;
  type: OTOpType;
  position: number;
  text?: string;
  length?: number;
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

// ── Restore request ───────────────────────────────────────────────────────────

export interface RestoreRequest {
  targetRev: number;
}

export interface RestoreResponse {
  newRev: number;
  snapshotId: string;
}

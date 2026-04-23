// ── OT Operation types ────────────────────────────────────────────────────────

export type OTOpType = "insert" | "delete";

export interface OTInsert {
  type: "insert";
  position: number;
  text: string;
  clientId: string;
  opId: string;
  baseRev: number;
}

export interface OTDelete {
  type: "delete";
  position: number;
  length: number;
  clientId: string;
  opId: string;
  baseRev: number;
}

export type OTOperation = OTInsert | OTDelete;

// ── Wire format (matches DB columns and HTTP payload) ─────────────────────────

export interface OTOpPayload {
  opId: string;
  clientId: string;
  baseRev: number;
  type: OTOpType;
  position: number;
  /** Present for insert ops */
  text?: string;
  /** Present for delete ops */
  length?: number;
  createdAt: string;
}

export interface OTSyncRequest {
  clientId: string;
  baseRev: number;
  ops: OTOpPayload[];
}

export interface OTSyncResponse {
  acceptedOps: string[];
  remoteOps: OTOpPayload[];
  newRev: number;
}

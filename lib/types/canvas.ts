export interface CanvasNode {
  id: string;
  boardId: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: {
    text?: string;
    color?: string;
    fontSize?: number;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CanvasEdge {
  id: string;
  boardId: string;
  sourceId: string;
  targetId: string;
  label?: string;
  createdAt: string;
}

export interface BoardState {
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
}

export interface BoardMeta {
  id: string;
  workspaceId: string;
  title: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CanvasOpType =
  | "CREATE_NODE"
  | "MOVE_NODE"
  | "UPDATE_NODE"
  | "DELETE_NODE"
  | "CONNECT_NODES"
  | "DELETE_EDGE";

export type CanvasOp =
  | { type: "CREATE_NODE"; payload: CanvasNode }
  | { type: "MOVE_NODE"; payload: { id: string; x: number; y: number } }
  | { type: "UPDATE_NODE"; payload: Partial<CanvasNode> & { id: string } }
  | { type: "DELETE_NODE"; payload: { id: string } }
  | { type: "CONNECT_NODES"; payload: CanvasEdge }
  | { type: "DELETE_EDGE"; payload: { id: string } }

export interface PresenceData {
  userId: string;
  name: string;
  x: number;
  y: number;
  color: string;
  updatedAt: number;
  draggingNodeId?: string | null;
}

export interface NodeMover {
  userId: string;
  name: string;
  color: string;
  expiresAt: number;
}

export interface ConflictInfo {
  entityId: string;
  entityType: "node" | "edge";
  winnerUserId: string;
  winnerName: string;
  loserUserId: string;
  loserName: string;
}

export interface PendingOp {
  operationId: string;
  boardId: string;
  workspaceId: string;
  op: CanvasOp;
  createdAt: string;
  status: "pending" | "syncing" | "committed" | "rejected";
}

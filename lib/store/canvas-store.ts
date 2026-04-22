"use client";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  BoardState,
  CanvasNode,
  CanvasEdge,
  CanvasOp,
  PendingOp,
  PresenceData,
} from "@/lib/types/canvas";

interface CanvasStoreState {
  boardId: string | null;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  pendingOps: PendingOp[];
  selectedNodeId: string | null;
  presence: Record<string, PresenceData>;
  stagePos: { x: number; y: number };
  stageScale: number;
}

interface CanvasStoreActions {
  initBoard: (boardId: string, state: BoardState) => void;
  applyOp: (op: CanvasOp) => void;
  applyCommitted: (operationId: string) => void;
  rollbackOp: (operationId: string) => void;
  enqueuePendingOp: (pendingOp: PendingOp) => void;
  markOpSyncing: (operationId: string, proposalId: string) => void;
  updatePresence: (data: PresenceData) => void;
  removePresence: (userId: string) => void;
  setSelectedNode: (id: string | null) => void;
  setStagePos: (pos: { x: number; y: number }) => void;
  setStageScale: (scale: number) => void;
  reset: () => void;
}

type CanvasStore = CanvasStoreState & CanvasStoreActions;

const initialState: CanvasStoreState = {
  boardId: null,
  nodes: {},
  edges: {},
  pendingOps: [],
  selectedNodeId: null,
  presence: {},
  stagePos: { x: 0, y: 0 },
  stageScale: 1,
};

function applyOpToState(
  state: CanvasStoreState,
  op: CanvasOp
): void {
  switch (op.type) {
    case "CREATE_NODE":
      state.nodes[op.payload.id] = op.payload;
      break;
    case "MOVE_NODE": {
      const node = state.nodes[op.payload.id];
      if (node) {
        node.x = op.payload.x;
        node.y = op.payload.y;
      }
      break;
    }
    case "UPDATE_NODE": {
      const node = state.nodes[op.payload.id];
      if (node) {
        Object.assign(node, op.payload);
      }
      break;
    }
    case "DELETE_NODE": {
      delete state.nodes[op.payload.id];
      // Remove connected edges
      for (const edgeId of Object.keys(state.edges)) {
        const edge = state.edges[edgeId];
        if (edge.sourceId === op.payload.id || edge.targetId === op.payload.id) {
          delete state.edges[edgeId];
        }
      }
      if (state.selectedNodeId === op.payload.id) {
        state.selectedNodeId = null;
      }
      break;
    }
    case "CONNECT_NODES":
      state.edges[op.payload.id] = op.payload;
      break;
  }
}

export const useCanvasStore = create<CanvasStore>()(
  immer((set) => ({
    ...initialState,

    initBoard: (boardId, { nodes, edges }) =>
      set((state) => {
        state.boardId = boardId;
        state.nodes = nodes;
        state.edges = edges;
        state.pendingOps = [];
        state.presence = {};
      }),

    applyOp: (op) =>
      set((state) => {
        applyOpToState(state, op);
      }),

    enqueuePendingOp: (pendingOp) =>
      set((state) => {
        state.pendingOps.push(pendingOp);
      }),

    markOpSyncing: (operationId, proposalId) =>
      set((state) => {
        const op = state.pendingOps.find((o) => o.operationId === operationId);
        if (op) {
          op.status = "syncing";
          op.proposalId = proposalId;
        }
      }),

    applyCommitted: (operationId: string) =>
      set((state) => {
        state.pendingOps = state.pendingOps.filter(
          (o) => o.operationId !== operationId
        );
      }),

    rollbackOp: (operationId) =>
      set((state) => {
        const opIdx = state.pendingOps.findIndex(
          (o) => o.operationId === operationId
        );
        if (opIdx === -1) return;

        const pending = state.pendingOps[opIdx];
        state.pendingOps.splice(opIdx, 1);

        // Reverse the operation
        const op = pending.op;
        switch (op.type) {
          case "CREATE_NODE":
            delete state.nodes[op.payload.id];
            break;
          case "DELETE_NODE":
            // Can't fully restore without storing old state; mark as removed
            break;
          case "MOVE_NODE": {
            // Without prior position stored, we can't reverse precisely
            break;
          }
          case "UPDATE_NODE":
            break;
          case "CONNECT_NODES":
            delete state.edges[op.payload.id];
            break;
        }
      }),

    updatePresence: (data) =>
      set((state) => {
        state.presence[data.userId] = data;
      }),

    removePresence: (userId) =>
      set((state) => {
        delete state.presence[userId];
      }),

    setSelectedNode: (id) =>
      set((state) => {
        state.selectedNodeId = id;
      }),

    setStagePos: (pos) =>
      set((state) => {
        state.stagePos = pos;
      }),

    setStageScale: (scale) =>
      set((state) => {
        state.stageScale = scale;
      }),

    reset: () => set(() => ({ ...initialState })),
  }))
);

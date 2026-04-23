"use client";
import { useRef, useCallback, useEffect, useState } from "react";
import { Stage, Layer } from "react-konva";
import type Konva from "konva";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { NodeComponent } from "./node-component";
import { EdgeComponent } from "./edge-component";
import { PresenceLayer } from "./presence-layer";
import { CanvasToolbar } from "./toolbar";
import { NodePropertiesPanel } from "./node-properties-panel";
import { useCanvasDispatch } from "@/lib/hooks/use-canvas";
import { useCanvasPresence } from "@/lib/hooks/use-canvas-presence";
import type { CanvasNode, CanvasEdge, NodeMover } from "@/lib/types/canvas";

interface CanvasBoardProps {
  boardId: string;
  workspaceId: string;
}

const ZOOM_FACTOR = 1.05;
const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const MOVER_EXPIRY_TICK_MS = 200;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const NODE_COLORS = [
  "#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3",
  "#ede9fe", "#ffedd5", "#f0fdf4", "#e0f2fe",
];

export function CanvasBoard({ boardId, workspaceId }: CanvasBoardProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const stagePos = useCanvasStore((s) => s.stagePos);
  const stageScale = useCanvasStore((s) => s.stageScale);
  const presence = useCanvasStore((s) => s.presence);
  const nodeMovers = useCanvasStore((s) => s.nodeMovers);
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode);
  const setSelectedEdge = useCanvasStore((s) => s.setSelectedEdge);
  const setStagePos = useCanvasStore((s) => s.setStagePos);
  const setStageScale = useCanvasStore((s) => s.setStageScale);
  const clearExpiredMovers = useCanvasStore((s) => s.clearExpiredMovers);

  const dispatch = useCanvasDispatch(boardId, workspaceId);
  const { sendPresence } = useCanvasPresence(boardId);

  // Periodically clear expired node mover labels
  useEffect(() => {
    const timer = setInterval(clearExpiredMovers, MOVER_EXPIRY_TICK_MS);
    return () => clearInterval(timer);
  }, [clearExpiredMovers]);

  // Merge presence-based dragging movers with stored op-applied movers.
  // Presence shows who is actively dragging right now; store movers show
  // who just finished a move (visible for 3 s after op applied).
  const effectiveMovers: Record<string, NodeMover> = { ...nodeMovers };
  for (const p of Object.values(presence)) {
    if (p.draggingNodeId) {
      effectiveMovers[p.draggingNodeId] = {
        userId: p.userId,
        name: p.name,
        color: p.color,
        expiresAt: Infinity, // live while they are dragging
      };
    }
  }

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard delete
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        if (selectedNodeId) handleDeleteSelected();
        else if (selectedEdgeId) handleDeleteEdge(selectedEdgeId);
      }
      if (e.key === "Escape") {
        setConnectMode(false);
        setConnectSource(null);
        setSelectedNode(null);
        setSelectedEdge(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId, selectedEdgeId]);

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const canvasX = (pos.x - stagePos.x) / stageScale;
      const canvasY = (pos.y - stagePos.y) / stageScale;
      sendPresence(canvasX, canvasY);
    },
    [sendPresence, stagePos, stageScale]
  );

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, direction > 0 ? oldScale * ZOOM_FACTOR : oldScale / ZOOM_FACTOR)
      );

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      setStageScale(newScale);
      setStagePos(newPos);
    },
    [setStageScale, setStagePos]
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        setSelectedNode(null);
        setSelectedEdge(null);
        if (connectMode) {
          setConnectMode(false);
          setConnectSource(null);
        }
      }
    },
    [setSelectedNode, setSelectedEdge, connectMode]
  );

  const handleNodeSelect = useCallback(
    (id: string) => {
      if (connectMode) {
        if (!connectSource) {
          setConnectSource(id);
        } else if (connectSource !== id) {
          const edge: CanvasEdge = {
            id: generateId(),
            boardId,
            sourceId: connectSource,
            targetId: id,
            createdAt: new Date().toISOString(),
          };
          dispatch({ type: "CONNECT_NODES", payload: edge });
          setConnectSource(null);
          setConnectMode(false);
        }
      } else {
        setSelectedNode(id);
      }
    },
    [connectMode, connectSource, boardId, dispatch, setSelectedNode]
  );

  const handleNodeDragStart = useCallback(
    (id: string) => {
      const node = nodes[id];
      if (!node) return;
      // Broadcast to other users that we're dragging this node
      sendPresence(node.x, node.y, id);
    },
    [nodes, sendPresence]
  );

  const handleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      // Clear the dragging presence signal
      sendPresence(x, y, null);
      dispatch({ type: "MOVE_NODE", payload: { id, x, y } });
    },
    [dispatch, sendPresence]
  );

  const handleResize = useCallback(
    (id: string, width: number, height: number, x: number, y: number) => {
      dispatch({
        type: "UPDATE_NODE",
        payload: { id, width, height, x, y },
      });
    },
    [dispatch]
  );

  const handleTextEdit = useCallback(
    (id: string, text: string) => {
      const node = nodes[id];
      if (!node) return;
      dispatch({
        type: "UPDATE_NODE",
        payload: {
          id,
          content: { ...node.content, text },
        },
      });
    },
    [dispatch, nodes]
  );

  const handleAddNode = useCallback(() => {
    const stage = stageRef.current;
    const centerX = stage ? (dimensions.width / 2 - stagePos.x) / stageScale : 200;
    const centerY = stage ? (dimensions.height / 2 - stagePos.y) / stageScale : 200;

    const colorIdx = Object.keys(nodes).length % NODE_COLORS.length;
    const node: CanvasNode = {
      id: generateId(),
      boardId,
      type: "default",
      x: centerX - 100,
      y: centerY - 60,
      width: 200,
      height: 120,
      content: {
        text: "New node",
        color: NODE_COLORS[colorIdx],
        fontSize: 14,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: "CREATE_NODE", payload: node });
    setSelectedNode(node.id);
  }, [boardId, dimensions, stagePos, stageScale, nodes, dispatch, setSelectedNode]);

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      dispatch({ type: "DELETE_EDGE", payload: { id: edgeId } });
      setSelectedEdge(null);
    },
    [dispatch, setSelectedEdge]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeId) {
      dispatch({ type: "DELETE_NODE", payload: { id: selectedNodeId } });
      setSelectedNode(null);
    } else if (selectedEdgeId) {
      handleDeleteEdge(selectedEdgeId);
    }
  }, [selectedNodeId, selectedEdgeId, dispatch, setSelectedNode, handleDeleteEdge]);

  const handleFitToScreen = useCallback(() => {
    const nodeList = Object.values(nodes);
    if (nodeList.length === 0) {
      setStagePos({ x: 0, y: 0 });
      setStageScale(1);
      return;
    }

    const padding = 60;
    const minX = Math.min(...nodeList.map((n) => n.x)) - padding;
    const minY = Math.min(...nodeList.map((n) => n.y)) - padding;
    const maxX = Math.max(...nodeList.map((n) => n.x + n.width)) + padding;
    const maxY = Math.max(...nodeList.map((n) => n.y + n.height)) + padding;

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, Math.min(dimensions.width / contentW, dimensions.height / contentH))
    );

    setStageScale(scale);
    setStagePos({
      x: (dimensions.width - contentW * scale) / 2 - minX * scale,
      y: (dimensions.height - contentH * scale) / 2 - minY * scale,
    });
  }, [nodes, dimensions, setStagePos, setStageScale]);

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(MAX_SCALE, stageScale * ZOOM_FACTOR);
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    setStagePos({
      x: cx - (cx - stagePos.x) * (newScale / stageScale),
      y: cy - (cy - stagePos.y) * (newScale / stageScale),
    });
    setStageScale(newScale);
  }, [stageScale, stagePos, dimensions, setStagePos, setStageScale]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(MIN_SCALE, stageScale / ZOOM_FACTOR);
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    setStagePos({
      x: cx - (cx - stagePos.x) * (newScale / stageScale),
      y: cy - (cy - stagePos.y) * (newScale / stageScale),
    });
    setStageScale(newScale);
  }, [stageScale, stagePos, dimensions, setStagePos, setStageScale]);

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-[#f8fafc] dark:bg-[#0f172a]">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #cbd5e1 1px, transparent 1px)`,
          backgroundSize: `${24 * stageScale}px ${24 * stageScale}px`,
          backgroundPosition: `${stagePos.x % (24 * stageScale)}px ${stagePos.y % (24 * stageScale)}px`,
        }}
      />

      <CanvasToolbar
        onAddNode={handleAddNode}
        onDeleteSelected={handleDeleteSelected}
        onFitToScreen={handleFitToScreen}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        connectMode={connectMode}
        onToggleConnectMode={() => {
          setConnectMode((v) => !v);
          setConnectSource(null);
        }}
      />

      {connectMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
          {connectSource ? "Click target node to connect" : "Click source node to start connection"}
        </div>
      )}

      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        draggable={!connectMode}
        onDragEnd={(e) => {
          if (e.target !== stageRef.current) return;
          setStagePos({ x: e.target.x(), y: e.target.y() });
        }}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={() => {
          setSelectedNode(null);
          setSelectedEdge(null);
          if (connectMode) {
            setConnectMode(false);
            setConnectSource(null);
          }
        }}
        onMouseMove={handleMouseMove}
        style={{ cursor: connectMode ? "crosshair" : "default" }}
      >
        {/* Edges layer */}
        <Layer>
          {Object.values(edges).map((edge) => (
            <EdgeComponent
              key={edge.id}
              edge={edge}
              sourceNode={nodes[edge.sourceId]}
              targetNode={nodes[edge.targetId]}
              isSelected={selectedEdgeId === edge.id}
              onSelect={setSelectedEdge}
            />
          ))}
        </Layer>

        {/* Nodes layer */}
        <Layer>
          {Object.values(nodes).map((node) => (
            <NodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id || connectSource === node.id}
              mover={effectiveMovers[node.id] ?? null}
              onSelect={handleNodeSelect}
              onDragStart={handleNodeDragStart}
              onDragEnd={handleDragEnd}
              onResize={handleResize}
              onTextEdit={handleTextEdit}
              stageRef={stageRef}
            />
          ))}
        </Layer>

        {/* Presence layer — other users' cursors */}
        <PresenceLayer />
      </Stage>

      {/* Node properties panel */}
      {selectedNodeId && nodes[selectedNodeId] && (
        <NodePropertiesPanel
          node={nodes[selectedNodeId]}
          stagePos={stagePos}
          stageScale={stageScale}
          onColorChange={(color) =>
            dispatch({
              type: "UPDATE_NODE",
              payload: {
                id: selectedNodeId,
                content: { ...nodes[selectedNodeId].content, color },
              },
            })
          }
          onFontSizeChange={(fontSize) =>
            dispatch({
              type: "UPDATE_NODE",
              payload: {
                id: selectedNodeId,
                content: { ...nodes[selectedNodeId].content, fontSize },
              },
            })
          }
        />
      )}
    </div>
  );
}

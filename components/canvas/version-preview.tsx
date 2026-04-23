"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Rect, Text, Arrow, Group } from "react-konva";
import type Konva from "konva";
import { X, RotateCcw, Eye, Loader2 } from "lucide-react";
import type { CanvasNode, CanvasEdge } from "@/lib/types/canvas";
import type { VersionSummary } from "./version-history-panel";

interface VersionPreviewProps {
  boardId: string;
  version: VersionSummary;
  onClose: () => void;
  onRestore: (version: VersionSummary) => void;
  restoring?: boolean;
}

const ZOOM_FACTOR = 1.05;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

function getNodeCenter(node: CanvasNode) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

export function VersionPreview({
  boardId,
  version,
  onClose,
  onRestore,
  restoring = false,
}: VersionPreviewProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [nodes, setNodes] = useState<Record<string, CanvasNode>>({});
  const [edges, setEdges] = useState<Record<string, CanvasEdge>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // Fetch version detail
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/boards/${boardId}/versions/${version.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          version: {
            nodes: Record<string, CanvasNode>;
            edges: Record<string, CanvasEdge>;
          };
        };
        setNodes(data.version.nodes);
        setEdges(data.version.edges);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load version"))
      .finally(() => setLoading(false));
  }, [boardId, version.id]);

  // Observe container size
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

  // Auto-fit after nodes load
  useEffect(() => {
    if (loading || Object.keys(nodes).length === 0) return;
    const padding = 60;
    const nodeList = Object.values(nodes);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, nodes]);

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
      setStageScale(newScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    []
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const formattedDate = new Date(version.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs font-medium">
            <Eye className="w-3 h-3" />
            Read-only preview
          </div>
          <div className="text-sm text-foreground">
            <span className="font-medium">{version.createdByName}</span>
            {version.label && (
              <span className="text-muted-foreground italic ml-1">— {version.label}</span>
            )}
            <span className="text-muted-foreground ml-1.5 text-xs">{formattedDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!confirmRestore ? (
            <button
              type="button"
              onClick={() => setConfirmRestore(true)}
              disabled={loading || !!error || restoring}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore this version
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Replace the canvas for all collaborators?
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirmRestore(false);
                  onRestore(version);
                }}
                disabled={restoring}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {restoring ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                {restoring ? "Restoring…" : "Yes, restore"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRestore(false)}
                className="text-xs px-2.5 py-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-[#f8fafc] dark:bg-[#0f172a]"
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #cbd5e1 1px, transparent 1px)`,
            backgroundSize: `${24 * stageScale}px ${24 * stageScale}px`,
            backgroundPosition: `${stagePos.x % (24 * stageScale)}px ${stagePos.y % (24 * stageScale)}px`,
          }}
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading version…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <Stage
            ref={stageRef}
            width={dimensions.width}
            height={dimensions.height}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            draggable
            onDragEnd={(e) => {
              if (e.target !== stageRef.current) return;
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }}
            onWheel={handleWheel}
            style={{ cursor: "grab" }}
          >
            {/* Edges */}
            <Layer>
              {Object.values(edges).map((edge) => {
                const src = nodes[edge.sourceId];
                const tgt = nodes[edge.targetId];
                if (!src || !tgt) return null;
                const sc = getNodeCenter(src);
                const tc = getNodeCenter(tgt);
                return (
                  <Arrow
                    key={edge.id}
                    points={[sc.x, sc.y, tc.x, tc.y]}
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    fill="#94a3b8"
                    pointerLength={10}
                    pointerWidth={8}
                    listening={false}
                  />
                );
              })}
            </Layer>

            {/* Nodes */}
            <Layer>
              {Object.values(nodes).map((node) => {
                const fillColor = (node.content.color as string) ?? "#ffffff";
                const text = (node.content.text as string) ?? "";
                const fontSize = (node.content.fontSize as number) ?? 14;
                return (
                  <Group key={node.id} x={node.x} y={node.y} listening={false}>
                    <Rect
                      width={node.width}
                      height={node.height}
                      fill={fillColor}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                      cornerRadius={8}
                      shadowBlur={4}
                      shadowColor="rgba(0,0,0,0.15)"
                      shadowOffsetY={2}
                    />
                    <Text
                      x={8}
                      y={8}
                      width={node.width - 16}
                      height={node.height - 16}
                      text={text}
                      fontSize={fontSize}
                      fontFamily="Inter, system-ui, sans-serif"
                      fill="#1e293b"
                      wrap="word"
                      ellipsis
                      lineHeight={1.4}
                    />
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        )}

        {!loading && !error && Object.keys(nodes).length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-muted-foreground">Empty canvas at this version</p>
          </div>
        )}
      </div>
    </div>
  );
}

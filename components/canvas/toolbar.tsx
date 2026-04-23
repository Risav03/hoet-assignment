"use client";
import { Plus, Trash2, ZoomIn, ZoomOut, Maximize2, Link, History } from "lucide-react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  onAddNode: () => void;
  onDeleteSelected: () => void;
  onFitToScreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  connectMode: boolean;
  onToggleConnectMode: () => void;
  historyOpen: boolean;
  onToggleHistory: () => void;
}

export function CanvasToolbar({
  onAddNode,
  onDeleteSelected,
  onFitToScreen,
  onZoomIn,
  onZoomOut,
  connectMode,
  onToggleConnectMode,
  historyOpen,
  onToggleHistory,
}: ToolbarProps) {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const hasSelection = !!(selectedNodeId || selectedEdgeId);
  const pendingCount = useCanvasStore((s) => s.pendingOps.filter((o) => o.status === "pending").length);
  const stageScale = useCanvasStore((s) => s.stageScale);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-background/90 backdrop-blur-sm border border-border rounded-xl shadow-lg px-2 py-1.5">
      <ToolbarButton
        icon={<Plus className="w-4 h-4" />}
        label="Add node"
        onClick={onAddNode}
      />

      <ToolbarButton
        icon={<Link className="w-4 h-4" />}
        label="Connect nodes"
        onClick={onToggleConnectMode}
        active={connectMode}
      />

      <ToolbarButton
        icon={<Trash2 className="w-4 h-4" />}
        label="Delete selected"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        variant="danger"
      />

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton icon={<ZoomOut className="w-4 h-4" />} label="Zoom out" onClick={onZoomOut} />
      <span className="text-xs font-mono text-muted-foreground w-10 text-center">
        {Math.round(stageScale * 100)}%
      </span>
      <ToolbarButton icon={<ZoomIn className="w-4 h-4" />} label="Zoom in" onClick={onZoomIn} />
      <ToolbarButton icon={<Maximize2 className="w-4 h-4" />} label="Fit to screen" onClick={onFitToScreen} />

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        icon={<History className="w-4 h-4" />}
        label="Version history"
        onClick={onToggleHistory}
        active={historyOpen}
      />

      {pendingCount > 0 && (
        <>
          <div className="w-px h-5 bg-border mx-1" />
          <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
            {pendingCount} syncing
          </span>
        </>
      )}
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "danger";
}

function ToolbarButton({ icon, label, onClick, disabled, active, variant = "default" }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        active
          ? "bg-primary text-primary-foreground"
          : variant === "danger"
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
          : "text-foreground hover:bg-accent"
      )}
    >
      {icon}
    </button>
  );
}

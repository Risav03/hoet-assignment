"use client";
import type { CanvasNode } from "@/lib/types/canvas";
import { cn } from "@/lib/utils";

const NODE_COLORS = [
  "#fef3c7",
  "#dbeafe",
  "#dcfce7",
  "#fce7f3",
  "#ede9fe",
  "#ffedd5",
  "#f0fdf4",
  "#e0f2fe",
  "#fee2e2",
  "#f1f5f9",
];

const FONT_SIZES = [10, 12, 14, 16, 20, 24];

interface NodePropertiesPanelProps {
  node: CanvasNode;
  stagePos: { x: number; y: number };
  stageScale: number;
  onColorChange: (color: string) => void;
  onFontSizeChange: (fontSize: number) => void;
}

export function NodePropertiesPanel({
  node,
  stagePos,
  stageScale,
  onColorChange,
  onFontSizeChange,
}: NodePropertiesPanelProps) {
  // Convert canvas coordinates to screen coordinates
  const screenX = node.x * stageScale + stagePos.x;
  const screenY = node.y * stageScale + stagePos.y;
  const nodeScreenWidth = node.width * stageScale;
  const nodeScreenHeight = node.height * stageScale;

  // Position panel below the node, centered
  const panelTop = screenY + nodeScreenHeight + 8;
  const panelLeft = screenX + nodeScreenWidth / 2;

  const currentColor = node.content.color ?? "#fef3c7";
  const currentFontSize = node.content.fontSize ?? 14;

  return (
    <div
      className="absolute z-20 -translate-x-1/2 pointer-events-auto"
      style={{ top: panelTop, left: panelLeft }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-lg px-3 py-2">
        {/* Color swatches */}
        <div className="flex items-center gap-1">
          {NODE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              onClick={() => onColorChange(color)}
              className={cn(
                "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                currentColor === color
                  ? "border-primary scale-110"
                  : "border-transparent"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Font size */}
        <div className="flex items-center gap-1">
          {FONT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              title={`Font size ${size}`}
              onClick={() => onFontSizeChange(size)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors",
                currentFontSize === size
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

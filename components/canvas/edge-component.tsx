"use client";
import { Arrow, Text, Group, Circle } from "react-konva";
import type { CanvasEdge, CanvasNode } from "@/lib/types/canvas";

interface EdgeComponentProps {
  edge: CanvasEdge;
  sourceNode: CanvasNode | undefined;
  targetNode: CanvasNode | undefined;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function getNodeCenter(node: CanvasNode): { x: number; y: number } {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function getEdgePoints(
  source: CanvasNode,
  target: CanvasNode
): number[] {
  const src = getNodeCenter(source);
  const tgt = getNodeCenter(target);
  return [src.x, src.y, tgt.x, tgt.y];
}

function getMidpoint(points: number[]): { x: number; y: number } {
  return {
    x: (points[0] + points[2]) / 2,
    y: (points[1] + points[3]) / 2,
  };
}

export function EdgeComponent({
  edge,
  sourceNode,
  targetNode,
  isSelected,
  onSelect,
}: EdgeComponentProps) {
  if (!sourceNode || !targetNode) return null;

  const points = getEdgePoints(sourceNode, targetNode);
  const mid = getMidpoint(points);

  return (
    <Group onClick={() => onSelect(edge.id)} onTap={() => onSelect(edge.id)}>
      <Arrow
        points={points}
        stroke={isSelected ? "#3b82f6" : "#94a3b8"}
        strokeWidth={isSelected ? 2.5 : 1.5}
        fill={isSelected ? "#3b82f6" : "#94a3b8"}
        pointerLength={10}
        pointerWidth={8}
        tension={0}
        listening
      />
      {edge.label && (
        <Group x={mid.x} y={mid.y}>
          <Circle
            x={0}
            y={0}
            radius={Math.max(28, edge.label.length * 5)}
            fill="white"
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          <Text
            x={-Math.max(28, edge.label.length * 5)}
            y={-8}
            width={Math.max(56, edge.label.length * 10)}
            align="center"
            text={edge.label}
            fontSize={11}
            fontFamily="Inter, system-ui, sans-serif"
            fill="#475569"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}

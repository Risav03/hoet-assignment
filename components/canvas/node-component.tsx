"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { Group, Rect, Text, Transformer, Label, Tag } from "react-konva";
import type Konva from "konva";
import type { CanvasNode, NodeMover } from "@/lib/types/canvas";

interface NodeComponentProps {
  node: CanvasNode;
  isSelected: boolean;
  mover?: NodeMover | null;
  onSelect: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number, x: number, y: number) => void;
  onTextEdit: (id: string, text: string) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
}

const MIN_WIDTH = 80;
const MIN_HEIGHT = 50;

export function NodeComponent({
  node,
  isSelected,
  mover,
  onSelect,
  onDragStart,
  onDragEnd,
  onResize,
  onTextEdit,
  stageRef,
}: NodeComponentProps) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fillColor = (node.content.color as string) ?? "#ffffff";
  const text = (node.content.text as string) ?? "";
  const fontSize = (node.content.fontSize as number) ?? 14;

  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDblClick = useCallback(() => {
    if (!stageRef.current || !groupRef.current) return;
    setIsEditing(true);

    const stage = stageRef.current;
    const stageContainer = stage.container();
    const stageBox = stageContainer.getBoundingClientRect();
    const absPos = groupRef.current.getAbsolutePosition();
    const scale = stage.scaleX();

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = `
      position: fixed;
      top: ${stageBox.top + absPos.y * scale}px;
      left: ${stageBox.left + absPos.x * scale}px;
      width: ${node.width * scale}px;
      min-height: ${node.height * scale}px;
      font-size: ${fontSize * scale}px;
      font-family: inherit;
      line-height: 1.4;
      border: 2px solid #3b82f6;
      border-radius: 6px;
      padding: 8px;
      resize: none;
      background: ${fillColor};
      color: #1e293b;
      outline: none;
      overflow: hidden;
      z-index: 9999;
      box-sizing: border-box;
    `;

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const finish = () => {
      const newText = textarea.value;
      document.body.removeChild(textarea);
      setIsEditing(false);
      if (newText !== text) {
        onTextEdit(node.id, newText);
      }
    };

    textarea.addEventListener("blur", finish);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        textarea.value = text;
        finish();
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        finish();
      }
    });
  }, [stageRef, text, node.width, node.height, node.id, fontSize, fillColor, onTextEdit]);

  const handleTransformEnd = useCallback(() => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    const scaleX = group.scaleX();
    const scaleY = group.scaleY();

    const newWidth = Math.max(MIN_WIDTH, node.width * scaleX);
    const newHeight = Math.max(MIN_HEIGHT, node.height * scaleY);

    group.scaleX(1);
    group.scaleY(1);

    onResize(node.id, newWidth, newHeight, group.x(), group.y());
  }, [node.id, node.width, node.height, onResize]);

  return (
    <>
      <Group
        ref={groupRef}
        id={node.id}
        x={node.x}
        y={node.y}
        draggable
        onClick={() => onSelect(node.id)}
        onTap={() => onSelect(node.id)}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragStart={() => onDragStart?.(node.id)}
        onDragEnd={(e) => {
          onDragEnd(node.id, e.target.x(), e.target.y());
        }}
        onTransformEnd={handleTransformEnd}
        opacity={isEditing ? 0.4 : 1}
      >
        <Rect
          width={node.width}
          height={node.height}
          fill={fillColor}
          stroke={isSelected ? "#3b82f6" : "#e2e8f0"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={8}
          shadowBlur={isSelected ? 8 : 4}
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
          listening={false}
        />

        {/* Mover attribution label shown below the node */}
        {mover && (
          <Label x={8} y={node.height + 6} listening={false}>
            <Tag
              fill={mover.color}
              cornerRadius={4}
              shadowBlur={3}
              shadowColor="rgba(0,0,0,0.2)"
              shadowOffsetY={1}
            />
            <Text
              text={`▸ ${mover.name}`}
              fontSize={10}
              fontFamily="Inter, system-ui, sans-serif"
              fontStyle="bold"
              fill="white"
              padding={4}
              listening={false}
            />
          </Label>
        )}
      </Group>

      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          enabledAnchors={[
            "top-left", "top-right",
            "bottom-left", "bottom-right",
            "middle-right", "middle-left",
            "top-center", "bottom-center",
          ]}
          boundBoxFunc={(oldBox, newBox) => ({
            ...newBox,
            width: Math.max(MIN_WIDTH, newBox.width),
            height: Math.max(MIN_HEIGHT, newBox.height),
          })}
        />
      )}
    </>
  );
}

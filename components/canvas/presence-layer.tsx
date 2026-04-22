"use client";
import { Layer, Circle, Text, Group } from "react-konva";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { useSession } from "next-auth/react";

export function PresenceLayer() {
  const presence = useCanvasStore((s) => s.presence);
  const { data: session } = useSession();

  const others = Object.values(presence).filter(
    (p) => p.userId !== session?.user?.id
  );

  if (others.length === 0) return null;

  return (
    <Layer listening={false}>
      {others.map((p) => {
        const initials = p.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        return (
          <Group key={p.userId} x={p.x} y={p.y}>
            {/* Cursor dot */}
            <Circle
              x={0}
              y={0}
              radius={6}
              fill={p.color}
              stroke="white"
              strokeWidth={2}
              shadowBlur={4}
              shadowColor={p.color}
            />
            {/* Name badge */}
            <Group x={10} y={-6}>
              <Circle
                x={10}
                y={8}
                radius={12}
                fill={p.color}
              />
              <Text
                x={0}
                y={1}
                width={20}
                align="center"
                text={initials}
                fontSize={9}
                fontFamily="Inter, system-ui, sans-serif"
                fontStyle="bold"
                fill="white"
                listening={false}
              />
            </Group>
          </Group>
        );
      })}
    </Layer>
  );
}

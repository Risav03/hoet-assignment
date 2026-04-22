"use client";
import { useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import type { PresenceData } from "@/lib/types/canvas";

const PRESENCE_THROTTLE_MS = 100;
const PRESENCE_TIMEOUT_MS = 10_000;

const USER_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export function useCanvasPresence(boardId: string | null) {
  const { data: session } = useSession();
  const updatePresence = useCanvasStore((s) => s.updatePresence);
  const removePresence = useCanvasStore((s) => s.removePresence);

  const lastSendRef = useRef(0);
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const sendPresence = useCallback(
    async (x: number, y: number) => {
      if (!boardId || !session?.user?.id || !session.user.name) return;

      const now = Date.now();
      if (now - lastSendRef.current < PRESENCE_THROTTLE_MS) return;
      lastSendRef.current = now;

      try {
        await fetch(`/api/boards/${boardId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            x,
            y,
            name: session.user.name,
            color: getColorForUser(session.user.id),
          }),
        });
      } catch {
        // ignore presence errors silently
      }
    },
    [boardId, session?.user?.id, session?.user?.name]
  );

  const handleRemotePresence = useCallback(
    (data: PresenceData) => {
      if (!session?.user?.id || data.userId === session.user.id) return;

      updatePresence(data);

      // Auto-remove stale cursors
      if (timeoutsRef.current[data.userId]) {
        clearTimeout(timeoutsRef.current[data.userId]);
      }
      timeoutsRef.current[data.userId] = setTimeout(() => {
        removePresence(data.userId);
        delete timeoutsRef.current[data.userId];
      }, PRESENCE_TIMEOUT_MS);
    },
    [session?.user?.id, updatePresence, removePresence]
  );

  // Clean up all timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  return { sendPresence, handleRemotePresence, getColorForUser };
}

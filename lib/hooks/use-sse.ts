"use client";
import { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useNetworkStatus } from "./use-network-status";

export interface SSEMessage {
  type: string;
  payload: Record<string, unknown>;
  workspaceId: string;
}

interface UseSSEOptions {
  workspaceId: string | null;
  onMessage: (msg: SSEMessage) => void;
  enabled?: boolean;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const POLL_INTERVAL = 15_000;

export function useSSE({ workspaceId, onMessage, enabled = true }: UseSSEOptions) {
  const isOnline = useNetworkStatus();
  const esRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastEventIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollSinceRef = useRef<string>(new Date().toISOString());
  const onMessageRef = useRef(onMessage);

  useLayoutEffect(() => {
    onMessageRef.current = onMessage;
  });

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!workspaceId) return;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    async function poll() {
      if (!workspaceId) return;
      try {
        const res = await fetch(
          `/api/events/poll?workspaceId=${workspaceId}&since=${encodeURIComponent(pollSinceRef.current)}`
        );
        if (res.ok) {
          const data = await res.json();
          pollSinceRef.current = data.serverTime;
          if (data.proposals?.length) {
            data.proposals.forEach((p: Record<string, unknown>) => {
              onMessageRef.current({ type: "proposal_updated", payload: p, workspaceId });
            });
          }
        }
      } catch {
        // ignore poll errors
      }
    }

    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
  }, [workspaceId]);

  // Store reconnect timer ref to avoid referencing `connect` before declaration
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (!workspaceId || !isOnline || !enabled) return;

    if (typeof EventSource === "undefined") {
      startPolling();
      return;
    }

    const url = new URL(`/api/events`, window.location.origin);
    url.searchParams.set("workspaceId", workspaceId);
    if (lastEventIdRef.current) url.searchParams.set("lastEventId", lastEventIdRef.current);

    const es = new EventSource(url.toString());
    esRef.current = es;

    es.addEventListener("open", () => {
      reconnectAttemptsRef.current = 0;
      stopPolling();
    });

    const handleMessage = (e: MessageEvent) => {
      if (e.lastEventId) lastEventIdRef.current = e.lastEventId;
      try {
        const data = JSON.parse(e.data) as SSEMessage;
        onMessageRef.current(data);
      } catch {
        // ignore parse errors
      }
    };

    const eventTypes = [
      "proposal_created",
      "proposal_updated",
      "proposal_committed",
      "proposal_rejected",
      "document_version_created",
      "document_updated",
      "member_invited",
      "member_role_updated",
      "sync_conflict_detected",
      "workspace_activity_logged",
    ];

    eventTypes.forEach((type) => {
      es.addEventListener(type, handleMessage);
    });

    es.addEventListener("error", () => {
      es.close();
      esRef.current = null;

      const delay = RECONNECT_DELAYS[
        Math.min(reconnectAttemptsRef.current, RECONNECT_DELAYS.length - 1)
      ];
      reconnectAttemptsRef.current += 1;

      startPolling();

      reconnectTimerRef.current = setTimeout(() => {
        stopPolling();
        connectRef.current?.();
      }, delay);
    });
  }, [workspaceId, isOnline, enabled, startPolling, stopPolling]);

  // Keep connectRef updated so the error handler can call it without capturing stale closure
  useLayoutEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
      stopPolling();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect, stopPolling]);

  useEffect(() => {
    if (isOnline && !esRef.current) {
      connect();
    }
  }, [isOnline, connect]);
}

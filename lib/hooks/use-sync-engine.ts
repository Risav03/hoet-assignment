"use client";
import { useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { runSyncEngine } from "@/lib/sync/engine";
import { useNetworkStatus } from "./use-network-status";

const BASE_INTERVAL = 15_000;
const RETRY_BACKOFF = [5_000, 10_000, 20_000, 40_000, 60_000];

export function useSyncEngine() {
  const { data: session } = useSession();
  const isOnline = useNetworkStatus();
  const retryCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = session?.user?.id ?? null;

  const sync = useCallback(async () => {
    if (!userId || !isOnline) return;
    try {
      await runSyncEngine(userId);
      retryCountRef.current = 0;
    } catch {
      retryCountRef.current = Math.min(retryCountRef.current + 1, RETRY_BACKOFF.length - 1);
    }
  }, [userId, isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    sync();

    function schedule() {
      const delay = retryCountRef.current > 0
        ? RETRY_BACKOFF[retryCountRef.current - 1]
        : BASE_INTERVAL;
      timerRef.current = setTimeout(async () => {
        await sync();
        schedule();
      }, delay);
    }

    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOnline, sync]);
}

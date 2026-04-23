"use client";
import { useEffect, useRef } from "react";

type EventHandler = (e: MessageEvent<string>) => void;

/**
 * Module-level ref-counted pool of EventSource instances, keyed by docId.
 *
 * Multiple hooks in the same render tree (e.g. useYjsSync + useDocPresence)
 * that subscribe to the same docId share a single underlying connection rather
 * than each opening a separate one.  The connection is closed only when the
 * last subscriber unmounts.
 */
interface PoolEntry {
  es: EventSource;
  refCount: number;
}

const pool = new Map<string, PoolEntry>();

function acquire(docId: string): EventSource {
  const existing = pool.get(docId);
  if (existing) {
    existing.refCount += 1;
    return existing.es;
  }
  const es = new EventSource(`/api/events?docId=${encodeURIComponent(docId)}`);
  pool.set(docId, { es, refCount: 1 });
  return es;
}

function release(docId: string): void {
  const entry = pool.get(docId);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.es.close();
    pool.delete(docId);
  }
}

/**
 * Attaches `handler` as a listener for `eventName` on the shared EventSource
 * for `docId`.  The connection is ref-counted: created on the first subscriber
 * and closed when the last one unmounts.
 *
 * The handler ref is updated on every render so callers never need to
 * unsubscribe/resubscribe when the handler closure changes.
 */
export function useDocEventSource(
  docId: string,
  eventName: string,
  handler: EventHandler
): void {
  const handlerRef = useRef<EventHandler>(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const es = acquire(docId);
    const stableHandler = (e: MessageEvent<string>) => handlerRef.current(e);
    es.addEventListener(eventName, stableHandler);

    return () => {
      es.removeEventListener(eventName, stableHandler);
      release(docId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, eventName]);
}

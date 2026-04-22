"use client";
/**
 * Legacy sync engine — kept for backward compatibility.
 * Canvas sync is handled by canvas-engine.ts.
 */

let syncRunning = false;

export async function enqueueSyncOperation(
  _op: Record<string, unknown>
) {
  // No-op: canvas ops are queued via canvas-engine.ts
}

export async function runSyncEngine(_userId: string): Promise<void> {
  if (syncRunning) return;
  syncRunning = true;
  try {
    // No-op: canvas sync handled by canvas-engine
  } finally {
    syncRunning = false;
  }
}

export function createOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function generateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

import { EventEmitter } from "events";

export interface SSEEvent {
  type: string;
  payload: Record<string, unknown>;
}

declare global {
  var sseEmitter: EventEmitter | undefined;
}

function getEmitter(): EventEmitter {
  if (!global.sseEmitter) {
    global.sseEmitter = new EventEmitter();
    global.sseEmitter.setMaxListeners(500);
  }
  return global.sseEmitter;
}

export function emitSSEEvent(workspaceId: string, event: SSEEvent) {
  getEmitter().emit(`workspace:${workspaceId}`, event);
}

export function subscribeToWorkspace(
  workspaceId: string,
  listener: (event: SSEEvent) => void
) {
  const emitter = getEmitter();
  emitter.on(`workspace:${workspaceId}`, listener);
  return () => emitter.off(`workspace:${workspaceId}`, listener);
}

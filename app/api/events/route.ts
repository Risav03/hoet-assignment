import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { subscribeToWorkspace, type SSEEvent } from "@/lib/sse/emitter";
import { getWorkspaceMember } from "@/lib/dal/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const member = await getWorkspaceMember(workspaceId, session.user.id);
  if (!member) {
    return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });
  }

  const lastEventId = req.headers.get("last-event-id");
  let eventCounter = lastEventId ? parseInt(lastEventId, 10) : 0;

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      const listener = (event: SSEEvent) => {
        try {
          eventCounter += 1;
          const data = JSON.stringify({ ...event, workspaceId });
          controller.enqueue(
            encoder.encode(`id: ${eventCounter}\nevent: ${event.type}\ndata: ${data}\n\n`)
          );
        } catch {
          // stream closed
        }
      };

      const unsubscribe = subscribeToWorkspace(workspaceId, listener);

      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ workspaceId, userId: session.user.id })}\n\n`
        )
      );

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

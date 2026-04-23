import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { createSubscriber } from "@/lib/redis";
import { workspaceChannel } from "@/lib/sse/redis-emitter";
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

  // Resume counter from standard EventSource Last-Event-ID header.
  const lastEventId = req.headers.get("last-event-id");
  let eventCounter = lastEventId ? parseInt(lastEventId, 10) : 0;
  if (!Number.isFinite(eventCounter)) eventCounter = 0;

  const channel = workspaceChannel(workspaceId);
  const encoder = new TextEncoder();

  // One dedicated subscriber per request so `unsubscribe()` only affects this stream
  // and so ioredis's subscriber-mode restrictions don't leak across requests.
  const subscriber = createSubscriber();

  let cleanup: (() => Promise<void>) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      const messageHandler = (ch: string, message: string) => {
        if (ch !== channel) return;
        try {
          const event = JSON.parse(message) as { type: string; payload: unknown };
          eventCounter += 1;
          const data = JSON.stringify({ ...event, workspaceId });
          controller.enqueue(
            encoder.encode(`id: ${eventCounter}\nevent: ${event.type}\ndata: ${data}\n\n`)
          );
        } catch {
          // swallow bad payloads / closed stream
        }
      };

      subscriber.on("message", messageHandler);

      try {
        await subscriber.subscribe(channel);
      } catch (err) {
        console.error("[events] subscribe failed", err);
        clearInterval(heartbeat);
        controller.close();
        subscriber.disconnect();
        return;
      }

      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ workspaceId, userId: session.user.id })}\n\n`
        )
      );

      cleanup = async () => {
        clearInterval(heartbeat);
        subscriber.off("message", messageHandler);
        try {
          await subscriber.unsubscribe(channel);
        } catch {
          // ignore
        }
        subscriber.disconnect();
      };
    },
    async cancel() {
      await cleanup?.();
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

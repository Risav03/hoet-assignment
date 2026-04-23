import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { createSubscriber } from "@/lib/redis";
import { workspaceChannel, docChannel } from "@/lib/sse/redis-emitter";
import { getWorkspaceMember } from "@/lib/dal/workspace";
import { requireDocumentMember } from "@/lib/dal/document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const docId = url.searchParams.get("docId");

  // At least one of workspaceId or docId is required
  if (!workspaceId && !docId) {
    return NextResponse.json({ error: "workspaceId or docId is required" }, { status: 400 });
  }

  // Build the list of channels to subscribe to
  const channels: string[] = [];

  if (workspaceId) {
    const member = await getWorkspaceMember(workspaceId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });
    }
    channels.push(workspaceChannel(workspaceId));
  }

  if (docId) {
    try {
      await requireDocumentMember(docId, session.user.id);
    } catch {
      return NextResponse.json({ error: "Not a document member" }, { status: 403 });
    }
    channels.push(docChannel(docId));
  }

  // Resume counter from standard EventSource Last-Event-ID header.
  const lastEventId = req.headers.get("last-event-id");
  let eventCounter = lastEventId ? parseInt(lastEventId, 10) : 0;
  if (!Number.isFinite(eventCounter)) eventCounter = 0;

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
        if (!channels.includes(ch)) return;
        try {
          const event = JSON.parse(message) as { type: string; payload: unknown };
          eventCounter += 1;
          const meta = workspaceId ? { workspaceId } : { docId };
          const data = JSON.stringify({ ...event, ...meta });
          controller.enqueue(
            encoder.encode(`id: ${eventCounter}\nevent: ${event.type}\ndata: ${data}\n\n`)
          );
        } catch {
          // swallow bad payloads / closed stream
        }
      };

      subscriber.on("message", messageHandler);

      try {
        for (const ch of channels) {
          await subscriber.subscribe(ch);
        }
      } catch (err) {
        console.error("[events] subscribe failed", err);
        clearInterval(heartbeat);
        controller.close();
        subscriber.disconnect();
        return;
      }

      const connectedMeta = workspaceId
        ? { workspaceId, userId: session.user.id }
        : { docId, userId: session.user.id };
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify(connectedMeta)}\n\n`)
      );

      cleanup = async () => {
        clearInterval(heartbeat);
        subscriber.off("message", messageHandler);
        try {
          for (const ch of channels) {
            await subscriber.unsubscribe(ch);
          }
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

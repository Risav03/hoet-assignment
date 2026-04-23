import { auth } from "@/auth";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai/provider";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
import { getClosestSnapshot, getOpsBetweenRevs } from "@/lib/dal/document";
import { replayOps } from "@/lib/sync/doc-merge";
import { db } from "@/lib/db";
import { z } from "zod";
import { NextResponse } from "next/server";

const chatSchema = z.object({
  workspaceId: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(10_000),
    })
  ).max(50),
  referencedDocumentIds: z.array(z.string()).max(10).default([]),
});

interface PmNode {
  type: string;
  text?: string;
  content?: PmNode[];
}

function pmJsonToText(node: unknown, depth = 0): string {
  const n = node as PmNode;
  if (!n || typeof n !== "object") return "";
  if (n.type === "text" && typeof n.text === "string") return n.text;
  const children = Array.isArray(n.content)
    ? n.content.map((c) => pmJsonToText(c, depth + 1)).join("")
    : "";
  // Block-level nodes get a newline separator
  const blockTypes = new Set([
    "doc", "paragraph", "heading", "blockquote",
    "bulletList", "orderedList", "listItem",
    "codeBlock", "horizontalRule",
  ]);
  return blockTypes.has(n.type) ? children + "\n" : children;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId, messages, referencedDocumentIds } = chatSchema.parse(body);

    // Enforce workspace membership
    let workspace: { name: string };
    try {
      const member = await requireWorkspaceMember(workspaceId, session.user.id);
      // Fetch workspace name for the system prompt
      const ws = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      });
      if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
      workspace = ws;
      void member; // membership confirmed
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch content for each referenced document (must belong to same workspace)
    const docs: { id: string; title: string; contentText: string }[] = [];
    if (referencedDocumentIds.length > 0) {
      const dbDocs = await db.document.findMany({
        where: {
          id: { in: referencedDocumentIds },
          workspaceId,
          isArchived: false,
        },
        select: { id: true, title: true, currentRev: true },
      });

      await Promise.all(
        dbDocs.map(async (doc) => {
          const snapshot = await getClosestSnapshot(doc.id, doc.currentRev);
          let content: unknown = snapshot?.content ?? null;
          if (snapshot && snapshot.rev < doc.currentRev) {
            const pendingOps = await getOpsBetweenRevs(doc.id, snapshot.rev, doc.currentRev);
            if (pendingOps.length > 0) content = replayOps(snapshot.content, pendingOps);
          }
          const contentText = content ? pmJsonToText(content).replace(/\n{3,}/g, "\n\n").trim() : "";
          docs.push({ id: doc.id, title: doc.title, contentText });
        })
      );
    }

    const systemPrompt = [
      `You are the AI assistant for workspace "${workspace.name}".`,
      `You may only discuss documents and content from this workspace. Do not fabricate content from other workspaces.`,
      docs.length > 0
        ? `The user has referenced the following document(s):\n\n${docs
            .map((d) => `### ${d.title} (id: ${d.id})\n\n${d.contentText || "(empty document)"}`)
            .join("\n\n---\n\n")}`
        : `No documents are referenced in this turn. Answer based on the conversation history only.`,
    ].join("\n\n");

    const { text } = await generateText({
      model: getAIModel(),
      system: systemPrompt,
      messages,
    });

    return NextResponse.json({ content: text });
  } catch (err) {
    console.error("[ai/chat]", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

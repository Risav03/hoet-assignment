import { auth } from "@/auth";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai/provider";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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

    // Documents have been replaced by canvas boards — no doc context available
    const docs: { id: string; title: string; contentSnapshot: string; tags: string[] }[] = [];
    void referencedDocumentIds;

    const systemPrompt = [
      `You are the AI assistant for workspace "${workspace.name}".`,
      `You may only discuss documents and content from this workspace. Do not fabricate content from other workspaces.`,
      docs.length > 0
        ? `The user has referenced the following document(s):\n\n${docs
            .map(
              (d) =>
                `### ${d.title} (id: ${d.id})${d.tags.length ? ` [tags: ${d.tags.join(", ")}]` : ""}\n\n${stripHtml(d.contentSnapshot)}`
            )
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

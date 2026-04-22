import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAIModel } from "@/lib/ai/provider";
import { requireWorkspaceMember } from "@/lib/dal/workspace";
import { generateText } from "ai";
import { z } from "zod";

const schema = z.object({
  workspaceId: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  nodeType: z.string().default("default"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId, prompt } = schema.parse(body);

    await requireWorkspaceMember(workspaceId, session.user.id);

    const model = getAIModel();
    const { text } = await generateText({
      model,
      prompt: `Generate concise canvas node content for: "${prompt}". Return just the node text, 1-3 sentences max.`,
    });

    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Not a workspace") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to generate node content" }, { status: 500 });
  }
}

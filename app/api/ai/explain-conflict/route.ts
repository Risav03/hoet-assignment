import { auth } from "@/auth";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai/provider";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  baseContent: z.string().max(50_000),
  proposedContent: z.string().max(50_000),
  context: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { baseContent, proposedContent, context } = schema.parse(body);

    const base = baseContent.replace(/<[^>]*>/g, " ").trim();
    const proposed = proposedContent.replace(/<[^>]*>/g, " ").trim();

    const { text } = await generateText({
      model: getAIModel(),
      prompt: `Explain the differences between these two document versions in plain English${context ? `. Context: ${context}` : ""}.\n\n--- ORIGINAL ---\n${base.slice(0, 3000)}\n\n--- PROPOSED ---\n${proposed.slice(0, 3000)}\n\nSummarize: what changed, why it might matter, and any potential issues.`,
    });

    return NextResponse.json({ explanation: text });
  } catch (err) {
    console.error("[ai/explain-conflict]", err);
    return NextResponse.json({ error: "Conflict explanation failed" }, { status: 500 });
  }
}

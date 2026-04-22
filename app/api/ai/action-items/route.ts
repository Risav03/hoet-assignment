import { auth } from "@/auth";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai/provider";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ content: z.string().min(1).max(100_000) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { content } = schema.parse(body);
    const plainText = content.replace(/<[^>]*>/g, " ").trim();

    const { text } = await generateText({
      model: getAIModel(),
      prompt: `Extract all action items and tasks from the following document. Format as a numbered list. If none exist, say "No action items found."\n\n${plainText}`,
    });

    return NextResponse.json({ actionItems: text });
  } catch (err) {
    console.error("[ai/action-items]", err);
    return NextResponse.json({ error: "Action item extraction failed" }, { status: 500 });
  }
}

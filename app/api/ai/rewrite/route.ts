import { auth } from "@/auth";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai/provider";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  content: z.string().min(1).max(100_000),
  tone: z.enum(["formal", "casual", "concise", "detailed", "persuasive"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { content, tone } = schema.parse(body);
    const plainText = content.replace(/<[^>]*>/g, " ").trim();

    const { text } = await generateText({
      model: getAIModel(),
      prompt: `Rewrite the following text in a ${tone} tone. Preserve the key information.\n\n${plainText}`,
    });

    return NextResponse.json({ rewritten: text });
  } catch (err) {
    console.error("[ai/rewrite]", err);
    return NextResponse.json({ error: "Rewrite failed" }, { status: 500 });
  }
}

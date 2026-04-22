import { auth } from "@/auth";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai/provider";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  content: z.string().min(1).max(100_000),
  format: z.enum(["bullets", "paragraph"]).default("paragraph"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { content, format } = schema.parse(body);
    const plainText = content.replace(/<[^>]*>/g, " ").trim();

    const { text } = await generateText({
      model: getAIModel(),
      prompt: `Summarize the following document content ${format === "bullets" ? "as bullet points" : "in a concise paragraph"}:\n\n${plainText}`,
    });

    return NextResponse.json({ summary: text });
  } catch (err) {
    console.error("[ai/summarize]", err);
    return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
  }
}

import { auth } from "@/auth";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai/provider";
import { z } from "zod";
import { NextResponse } from "next/server";

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(10_000),
    })
  ).max(50),
  documentContext: z.string().max(100_000).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { messages, documentContext } = chatSchema.parse(body);

    const systemPrompt = documentContext
      ? `You are a helpful AI assistant for a collaborative workspace platform. You have access to the following document context:\n\n---\n${documentContext}\n---\n\nAnswer questions about this document and help users work with it.`
      : "You are a helpful AI assistant for a collaborative workspace platform. Help users with their documents, writing, and workspace tasks.";

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

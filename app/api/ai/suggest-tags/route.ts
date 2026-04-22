import { auth } from "@/auth";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai/provider";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  title: z.string().max(500),
  content: z.string().max(100_000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, content } = schema.parse(body);
    const plainText = content.replace(/<[^>]*>/g, " ").trim();

    const { text } = await generateText({
      model: getAIModel(),
      prompt: `Suggest 3-7 relevant tags for the following document titled "${title}". Return only a JSON array of short tag strings.\n\nDocument content:\n${plainText.slice(0, 2000)}`,
    });

    let tags: string[] = [];
    try {
      tags = JSON.parse(text) as string[];
    } catch {
      tags = text
        .split(/[,\n]/)
        .map((t) => t.trim().replace(/['"]/g, ""))
        .filter((t) => t.length > 0 && t.length < 50)
        .slice(0, 7);
    }

    return NextResponse.json({ tags });
  } catch (err) {
    console.error("[ai/suggest-tags]", err);
    return NextResponse.json({ error: "Tag suggestion failed" }, { status: 500 });
  }
}

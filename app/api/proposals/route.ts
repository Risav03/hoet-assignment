import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceProposals } from "@/lib/dal/proposal";
import { ZodError } from "zod";
import { z } from "zod";

const listProposalsSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().optional(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "COMMITTED"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  try {
    const opts = listProposalsSchema.parse({
      workspaceId: url.searchParams.get("workspaceId"),
      boardId: url.searchParams.get("boardId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? 20,
    });
    const result = await getWorkspaceProposals(opts.workspaceId, session.user.id, opts);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[proposals GET]", err);
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 });
  }
}
